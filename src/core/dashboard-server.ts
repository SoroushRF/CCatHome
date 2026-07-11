import * as http from "http";
import * as crypto from "crypto";
import { getDb } from "./db.js";
import { ConfirmationStatus } from "./constants.js";
import {
  listPendingConfirmations,
  resolvePendingConfirmation,
} from "./confirmations.js";

let serverInstance: http.Server | null = null;
let pollInterval: NodeJS.Timeout | null = null;
let activeToken: string | null = null;

/** Escape untrusted strings before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DashboardStartResult {
  server: http.Server;
  token: string;
}

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
      --color-pending: #fbbf24;
      --color-running: #3b82f6;
      --color-completed: #10b981;
      --color-failed: #ef4444;
      --color-confirmation: #ec4899;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      padding: 24px;
    }
    header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);
    }
    .logo {
      font-size: 24px; font-weight: 700;
      background: linear-gradient(135deg, #818cf8 0%, #ec4899 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-live { background: rgba(16, 185, 129, 0.15); color: var(--color-completed); }
    .grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
    .panel {
      background: var(--panel-bg); border: 1px solid var(--border); border-radius: 16px;
      padding: 20px; display: flex; flex-direction: column; gap: 16px;
    }
    .panel-title { font-size: 14px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
    .step-list, .meta-list, .hitl-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
    .step-item, .meta-item, .hitl-item {
      padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03);
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .step-item { cursor: pointer; }
    .step-item.active, .step-item:hover { border: 1px solid var(--primary); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .status-pending { background: var(--color-pending); }
    .status-running { background: var(--color-running); }
    .status-completed { background: var(--color-completed); }
    .status-failed { background: var(--color-failed); }
    .status-requires_confirmation { background: var(--color-confirmation); }
    .viewer { display: flex; flex-direction: column; gap: 20px; }
    .log-content {
      font-family: 'JetBrains Mono', monospace; font-size: 12px; white-space: pre-wrap;
      background: rgba(0,0,0,0.35); border-radius: 8px; padding: 12px; max-height: 360px; overflow: auto;
    }
    .meta-label { font-size: 12px; color: var(--text-muted); }
    .meta-value { font-size: 12px; font-family: 'JetBrains Mono', monospace; }
    .hitl-item { flex-direction: column; align-items: stretch; }
    .hitl-cmd { font-family: 'JetBrains Mono', monospace; font-size: 12px; word-break: break-all; }
    .hitl-actions { display: flex; gap: 8px; }
    .btn { border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-approve { background: rgba(16,185,129,0.2); color: var(--color-completed); }
    .btn-reject { background: rgba(239,68,68,0.2); color: var(--color-failed); }
    .muted { color: var(--text-muted); font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div class="logo">CCatHome</div>
    <div id="connection-status" style="font-size: 14px; color: var(--text-muted);">Connecting...</div>
  </header>
  <div class="grid">
    <div class="panel">
      <div class="panel-title">Active Workflow</div>
      <div id="wf-name" style="font-weight: 600;">No active workflow</div>
      <div id="wf-status" style="font-size: 13px; color: var(--text-muted);">-</div>
      <div class="panel-title">Approvals (HITL)</div>
      <div class="hitl-list" id="hitl-list"><div class="muted">No pending confirmations</div></div>
      <div class="panel-title">Steps Map</div>
      <div class="step-list" id="step-list"></div>
    </div>
    <div class="viewer">
      <div class="panel">
        <div class="panel-title">Execution Console Logs</div>
        <div class="log-content" id="log-content">Select a step to view attempt logs...</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="panel">
          <div class="panel-title">Checkpoints Index</div>
          <div class="meta-list" id="checkpoint-list"></div>
        </div>
        <div class="panel">
          <div class="panel-title">Background Processes</div>
          <div class="meta-list" id="process-list"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    let activeStepId = null;
    let cachedSteps = [];
    const evSource = new EventSource('/api/events');
    evSource.onopen = () => {
      document.getElementById('connection-status').textContent = 'Connected';
      document.getElementById('connection-status').style.color = 'var(--color-completed)';
    };
    evSource.onerror = () => {
      document.getElementById('connection-status').textContent = 'Reconnecting...';
      document.getElementById('connection-status').style.color = 'var(--color-pending)';
    };
    evSource.onmessage = (event) => updateUI(JSON.parse(event.data));

    async function resolveConfirmation(id, action) {
      await fetch('/api/confirmations/' + encodeURIComponent(id) + '/' + action, {
        method: 'POST',
        credentials: 'same-origin',
      });
    }

    function updateUI(data) {
      const wf = data.workflow;
      if (wf) {
        document.getElementById('wf-name').textContent = wf.name;
        const statusEl = document.getElementById('wf-status');
        statusEl.textContent = '';
        statusEl.appendChild(document.createTextNode('Status: '));
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = wf.status;
        statusEl.appendChild(badge);
      }

      const hitlList = document.getElementById('hitl-list');
      hitlList.textContent = '';
      const confirmations = data.confirmations || [];
      if (confirmations.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'No pending confirmations';
        hitlList.appendChild(empty);
      }
      confirmations.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'hitl-item';
        if (c.question) {
          const q = document.createElement('div');
          q.className = 'meta-label';
          q.textContent = c.question;
          item.appendChild(q);
        }
        const cmd = document.createElement('div');
        cmd.className = 'hitl-cmd';
        cmd.textContent = c.command || '';
        const meta = document.createElement('div');
        meta.className = 'meta-label';
        meta.textContent = (c.type || 'permission') + (c.step_id ? (' · step ' + c.step_id) : '');
        const actions = document.createElement('div');
        actions.className = 'hitl-actions';
        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn btn-approve';
        approveBtn.textContent = 'Approve';
        approveBtn.onclick = () => resolveConfirmation(c.id, 'approve');
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn btn-reject';
        rejectBtn.textContent = 'Reject';
        rejectBtn.onclick = () => resolveConfirmation(c.id, 'reject');
        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        item.appendChild(cmd);
        item.appendChild(meta);
        item.appendChild(actions);
        hitlList.appendChild(item);
      });

      const steps = data.steps || [];
      cachedSteps = steps;
      const stepList = document.getElementById('step-list');
      stepList.textContent = '';
      if (steps.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'No steps available';
        stepList.appendChild(empty);
      }
      steps.forEach((step) => {
        const item = document.createElement('div');
        item.className = 'step-item' + (activeStepId === step.id ? ' active' : '');
        item.onclick = () => selectStep(step.id);
        const title = document.createElement('span');
        title.textContent = step.title || '';
        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.gap = '8px';
        right.style.alignItems = 'center';
        const tries = document.createElement('span');
        tries.className = 'meta-label';
        tries.textContent = 'tries: ' + String(step.retry_count ?? 0);
        const dot = document.createElement('span');
        const safeStatus = String(step.status || '').replace(/[^a-z_]/gi, '');
        dot.className = 'status-dot status-' + safeStatus;
        right.appendChild(tries);
        right.appendChild(dot);
        item.appendChild(title);
        item.appendChild(right);
        stepList.appendChild(item);
      });

      if (activeStepId) {
        const current = steps.find((s) => s.id === activeStepId);
        if (current) {
          document.getElementById('log-content').textContent =
            current.full_log || 'No logs recorded for this attempt.';
        }
      } else if (steps.length > 0) {
        selectStep(steps[0].id);
      }

      const cpList = document.getElementById('checkpoint-list');
      cpList.textContent = '';
      const checkpoints = data.checkpoints || [];
      if (checkpoints.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'No checkpoints registered';
        cpList.appendChild(empty);
      }
      checkpoints.forEach((cp) => {
        const row = document.createElement('div');
        row.className = 'meta-item';
        const label = document.createElement('span');
        label.className = 'meta-label';
        label.textContent = 'ID: ' + String(cp.id || '').substring(0, 8);
        const value = document.createElement('span');
        value.className = 'meta-value';
        value.textContent = cp.git_sha ? String(cp.git_sha).substring(0, 7) : 'no_git';
        row.appendChild(label);
        row.appendChild(value);
        cpList.appendChild(row);
      });

      const procList = document.getElementById('process-list');
      procList.textContent = '';
      const processes = data.processes || [];
      if (processes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'No active commands';
        procList.appendChild(empty);
      }
      processes.forEach((proc) => {
        const row = document.createElement('div');
        row.className = 'meta-item';
        const label = document.createElement('span');
        label.className = 'meta-label';
        label.textContent = 'PID: ' + String(proc.pid);
        const value = document.createElement('span');
        value.className = 'meta-value';
        value.textContent = String(proc.status || '');
        row.appendChild(label);
        row.appendChild(value);
        procList.appendChild(row);
      });
    }

    function selectStep(stepId) {
      activeStepId = stepId;
      const stepItems = document.querySelectorAll('.step-item');
      const steps = cachedSteps;
      const targetIndex = steps.findIndex((s) => s.id === stepId);
      stepItems.forEach((item, idx) => {
        if (idx === targetIndex) item.classList.add('active');
        else item.classList.remove('active');
      });
      const current = steps.find((s) => s.id === stepId);
      if (current) {
        document.getElementById('log-content').textContent =
          current.full_log || 'No logs recorded for this attempt.';
      }
    }
  </script>
</body>
</html>
`;

/**
 * Starts the local background HTTP dashboard server.
 */
export function startDashboardServer(port = 3141): Promise<DashboardStartResult> {
  return new Promise((resolve, reject) => {
    activeToken = crypto.randomBytes(16).toString("hex");

    const server = http.createServer((req, res) => {
      const reqUrl = req.url || "";
      const parsedUrl = new URL(reqUrl, `http://${req.headers.host || "localhost"}`);
      const queryToken = parsedUrl.searchParams.get("token");

      const parseCookies = (cookieHeader?: string): Record<string, string> => {
        const list: Record<string, string> = {};
        if (!cookieHeader) return list;
        cookieHeader.split(";").forEach((cookie) => {
          const parts = cookie.split("=");
          const key = parts.shift()?.trim() || "";
          list[key] = decodeURIComponent((parts.join("=") || "").trim());
        });
        return list;
      };

      const cookies = parseCookies(req.headers.cookie);
      const cookieToken = cookies["ccathome_token"];
      const isAuthenticated =
        (queryToken && queryToken === activeToken) ||
        (cookieToken && cookieToken === activeToken);

      if (!isAuthenticated) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized: Dashboard requires valid connection token.");
        return;
      }

      if (queryToken && queryToken === activeToken) {
        res.setHeader(
          "Set-Cookie",
          `ccathome_token=${activeToken}; HttpOnly; Path=/; SameSite=Strict`
        );
      }

      if (req.method === "GET" && (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(HTML_CONTENT);
        return;
      }

      const confirmMatch = parsedUrl.pathname.match(
        /^\/api\/confirmations\/([^/]+)\/(approve|reject)$/
      );
      if (req.method === "POST" && confirmMatch) {
        const id = decodeURIComponent(confirmMatch[1]);
        const action = confirmMatch[2];
        const response =
          action === "approve" ? ConfirmationStatus.APPROVED : ConfirmationStatus.REJECTED;
        const result = resolvePendingConfirmation(id, response);
        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === "GET" && parsedUrl.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const sendUpdate = () => {
          try {
            const db = getDb();
            const workflow = db
              .prepare(`SELECT id, name, status FROM workflows ORDER BY created_at DESC LIMIT 1`)
              .get() as { id: string; name: string; status: string } | undefined;

            let steps: any[] = [];
            if (workflow) {
              steps = db
                .prepare(
                  `SELECT id, title, status, retry_count, full_log FROM workflow_steps WHERE workflow_id = ?`
                )
                .all(workflow.id);
            }

            const checkpoints = db
              .prepare(`SELECT id, git_sha FROM checkpoints ORDER BY created_at DESC LIMIT 5`)
              .all();
            const processes = db
              .prepare(`SELECT pid, status FROM command_log ORDER BY started_at DESC LIMIT 5`)
              .all();
            const confirmations = listPendingConfirmations();

            res.write(
              `data: ${JSON.stringify({
                workflow,
                steps,
                checkpoints,
                processes,
                confirmations,
              })}\n\n`
            );
          } catch (_err) {
            res.write(
              `data: ${JSON.stringify({ steps: [], checkpoints: [], processes: [], confirmations: [] })}\n\n`
            );
          }
        };

        sendUpdate();
        const sseInterval = setInterval(sendUpdate, 1000);
        req.on("close", () => clearInterval(sseInterval));
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.on("error", (err) => reject(err));

    server.listen(port, "localhost", () => {
      serverInstance = server;
      (server as any).token = activeToken;
      resolve({ server, token: activeToken! });
    });
  });
}

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
