import * as http from "http";
import * as crypto from "crypto";
import { getDb } from "./db.js";
import { CommandStatus, WorkflowStatus } from "./constants.js";

let serverInstance: http.Server | null = null;
let pollInterval: NodeJS.Timeout | null = null;
let activeToken: string | null = null;

// CSS class / color token suffixes intentionally match StepStatus / WorkflowStatus /
// CommandStatus string values (see constants.ts). Client HTML cannot import TS enums;
// comparisons below interpolate enum values at server render time.
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CCatHome Agent Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0c10;
      --panel-bg: rgba(25, 27, 44, 0.45);
      --border: rgba(255, 255, 255, 0.06);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      
      --color-pending: #fbbf24;
      --color-running: #3b82f6;
      --color-completed: #10b981;
      --color-failed: #ef4444;
      --color-confirmation: #ec4899;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--bg);
      background-image: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.04) 0%, transparent 40%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
      padding: 24px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #818cf8 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-live {
      background: rgba(16, 185, 129, 0.15);
      color: var(--color-completed);
      border: 1px solid rgba(16, 185, 129, 0.3);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    .grid {
      display: grid;
      grid-template-columns: 350px 1fr;
      gap: 24px;
    }

    .panel {
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .panel:hover {
      box-shadow: 0 8px 32px 0 rgba(99, 102, 241, 0.05);
    }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      padding-bottom: 8px;
    }

    /* Workflow & Steps */
    .workflow-info {
      padding: 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: 500px;
    }

    .step-item {
      padding: 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid transparent;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }

    .step-item:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .step-item.active {
      background: rgba(99, 102, 241, 0.08);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .step-title {
      font-weight: 500;
      font-size: 14px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-pending { background: var(--color-pending); box-shadow: 0 0 8px var(--color-pending); }
    .status-running { background: var(--color-running); box-shadow: 0 0 8px var(--color-running); }
    .status-completed { background: var(--color-completed); box-shadow: 0 0 8px var(--color-completed); }
    .status-failed { background: var(--color-failed); box-shadow: 0 0 8px var(--color-failed); }
    .status-requires_confirmation { background: var(--color-confirmation); box-shadow: 0 0 8px var(--color-confirmation); }

    /* Right Side View */
    .viewer {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .log-viewer {
      flex: 1;
      min-height: 400px;
      display: flex;
      flex-direction: column;
    }

    .log-content {
      flex: 1;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #a7f3d0;
      overflow-y: auto;
      white-space: pre-wrap;
      max-height: 500px;
    }

    /* Meta details lists */
    .meta-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
    }

    .meta-item {
      display: flex;
      justify-content: space-between;
      padding: 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.01);
    }

    .meta-label {
      color: var(--text-muted);
    }

    .meta-value {
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-container">
      <div class="logo">CCatHome</div>
      <span class="badge badge-live">Live Connection</span>
    </div>
    <div id="connection-status" style="font-size: 14px; color: var(--text-muted);">Connecting...</div>
  </header>

  <div class="grid">
    <!-- Left panel: Workflow and Steps -->
    <div class="panel">
      <div class="panel-title">Active Workflow</div>
      <div class="workflow-info" id="workflow-info">
        <div style="font-weight: 600;" id="wf-name">No active workflow</div>
        <div style="font-size: 13px; color: var(--text-muted);" id="wf-status">-</div>
      </div>

      <div class="panel-title">Steps Map</div>
      <div class="step-list" id="step-list">
        <!-- populated dynamically -->
      </div>
    </div>

    <!-- Right pane: Console log viewer and Checkpoint list -->
    <div class="viewer">
      <div class="panel log-viewer">
        <div class="panel-title">Execution Console Logs</div>
        <div class="log-content" id="log-content">Select a step to view attempt logs...</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="panel">
          <div class="panel-title">Checkpoints Index</div>
          <div class="meta-list" id="checkpoint-list">
            <!-- populated dynamically -->
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Background Processes</div>
          <div class="meta-list" id="process-list">
            <!-- populated dynamically -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let activeStepId = null;
    let cachedSteps = [];

    const evSource = new EventSource('/api/events');

    evSource.onopen = () => {
      document.getElementById('connection-status').innerText = 'Connected';
      document.getElementById('connection-status').style.color = 'var(--color-completed)';
    };

    evSource.onerror = () => {
      document.getElementById('connection-status').innerText = 'Reconnecting...';
      document.getElementById('connection-status').style.color = 'var(--color-pending)';
    };

    evSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateUI(data);
    };

    function updateUI(data) {
      // 1. Update Workflow
      const wf = data.workflow;
      if (wf) {
        document.getElementById('wf-name').innerText = wf.name;
        document.getElementById('wf-status').innerHTML = 'Status: <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--color-' + wf.status + ')">' + wf.status + '</span>';
      }

      // 2. Update Steps
      const steps = data.steps || [];
      cachedSteps = steps;
      const stepList = document.getElementById('step-list');
      stepList.innerHTML = '';
      
      if (steps.length === 0) {
        stepList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center;">No steps available</div>';
      }

      steps.forEach(step => {
        const item = document.createElement('div');
        item.className = 'step-item' + (activeStepId === step.id ? ' active' : '');
        item.onclick = () => selectStep(step.id);
        
        item.innerHTML = \`
          <span class="step-title">\${step.title}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: var(--text-muted)">tries: \${step.retry_count}</span>
            <span class="status-dot status-\${step.status}"></span>
          </div>
        \`;
        stepList.appendChild(item);
      });

      // Update active step log if matching step updated
      if (activeStepId) {
        const current = steps.find(s => s.id === activeStepId);
        if (current) {
          document.getElementById('log-content').innerText = current.full_log || 'No logs recorded for this attempt.';
        }
      } else if (steps.length > 0 && !activeStepId) {
        // Auto select first step
        selectStep(steps[0].id);
      }

      // 3. Update Checkpoints
      const checkpoints = data.checkpoints || [];
      const cpList = document.getElementById('checkpoint-list');
      cpList.innerHTML = '';
      if (checkpoints.length === 0) {
        cpList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center;">No checkpoints registered</div>';
      }
      checkpoints.forEach(cp => {
        const row = document.createElement('div');
        row.className = 'meta-item';
        row.innerHTML = \`
          <span class="meta-label">ID: \${cp.id.substring(0, 8)}</span>
          <span class="meta-value">\${cp.git_sha ? cp.git_sha.substring(0, 7) : 'no_git'}</span>
        \`;
        cpList.appendChild(row);
      });

      // 4. Update Processes
      const processes = data.processes || [];
      const procList = document.getElementById('process-list');
      procList.innerHTML = '';
      if (processes.length === 0) {
        procList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center;">No active commands</div>';
      }
      processes.forEach(proc => {
        const row = document.createElement('div');
        row.className = 'meta-item';
        row.innerHTML = \`
          <span class="meta-label">PID: \${proc.pid}</span>
          <span class="meta-value" style="color: var(--color-\${proc.status === '${CommandStatus.RUNNING}' ? '${CommandStatus.RUNNING}' : '${WorkflowStatus.COMPLETED}'})">\${proc.status}</span>
        \`;
        procList.appendChild(row);
      });
    }

    function selectStep(stepId) {
      activeStepId = stepId;
      // update active select borders
      const stepItems = document.querySelectorAll('.step-item');
      const steps = cachedSteps;
      const targetIndex = steps.findIndex(s => s.id === stepId);
      
      stepItems.forEach((item, idx) => {
        if (idx === targetIndex) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      const current = steps.find(s => s.id === stepId);
      if (current) {
        document.getElementById('log-content').innerText = current.full_log || 'No logs recorded for this attempt.';
      }
    }
  </script>
</body>
</html>
`;

/**
 * Starts the local background HTTP dashboard server.
 */
export function startDashboardServer(port = 3141): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    // Generate secure random token
    activeToken = crypto.randomBytes(16).toString("hex");

    const server = http.createServer((req, res) => {
      // Parse query string and cookies
      const reqUrl = req.url || "";
      const parsedUrl = new URL(reqUrl, `http://${req.headers.host || "localhost"}`);
      const queryToken = parsedUrl.searchParams.get("token");

      const parseCookies = (cookieHeader?: string): Record<string, string> => {
        const list: Record<string, string> = {};
        if (!cookieHeader) return list;
        cookieHeader.split(";").forEach((cookie) => {
          const parts = cookie.split("=");
          list[parts[0].trim()] = (parts[1] || "").trim();
        });
        return list;
      };
      
      const cookies = parseCookies(req.headers.cookie);
      const cookieToken = cookies["ccathome_token"];

      // Verify token
      const isAuthenticated = (queryToken && queryToken === activeToken) || (cookieToken && cookieToken === activeToken);

      if (!isAuthenticated) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized: Dashboard requires valid connection token.");
        return;
      }

      // If authorized via query parameter, set cookie to avoid sending token in future requests
      if (queryToken && queryToken === activeToken) {
        res.setHeader("Set-Cookie", `ccathome_token=${activeToken}; HttpOnly; Path=/; SameSite=Strict`);
      }

      // 1. Serve home HTML UI
      if (req.method === "GET" && (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(HTML_CONTENT);
        return;
      }

      // 2. Serve Server-Sent Events (SSE) Endpoint
      if (req.method === "GET" && parsedUrl.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        const sendUpdate = () => {
          try {
            const db = getDb();

            // Fetch workflows
            const workflow = db.prepare(`
              SELECT id, name, status FROM workflows ORDER BY created_at DESC LIMIT 1
            `).get() as { id: string; name: string; status: string } | undefined;

            let steps: any[] = [];
            if (workflow) {
              steps = db.prepare(`
                SELECT id, title, status, retry_count, full_log FROM workflow_steps
                WHERE workflow_id = ?
              `).all(workflow.id);
            }

            // Fetch checkpoints
            const checkpoints = db.prepare(`
              SELECT id, git_sha FROM checkpoints ORDER BY created_at DESC LIMIT 5
            `).all();

            // Fetch active background processes
            const processes = db.prepare(`
              SELECT pid, status FROM command_log ORDER BY started_at DESC LIMIT 5
            `).all();

            const payload = {
              workflow,
              steps,
              checkpoints,
              processes,
            };

            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          } catch (_err) {
            // DB might be locked or not created yet, send empty fallback
            res.write(`data: ${JSON.stringify({ steps: [], checkpoints: [], processes: [] })}\n\n`);
          }
        };

        // Send initial push
        sendUpdate();

        // Setup polling interval
        const sseInterval = setInterval(sendUpdate, 1000);

        req.on("close", () => {
          clearInterval(sseInterval);
        });
        return;
      }

      // 404 handler
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(port, "localhost", () => {
      serverInstance = server;
      (server as any).token = activeToken;
      resolve(server);
    });
  });
}

/**
 * Stops the running dashboard server.
 */
export function stopDashboardServer(): void {
  activeToken = null;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
