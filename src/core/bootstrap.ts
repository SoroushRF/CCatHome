import { registerCapability } from "./router.js";

// Filesystem
import { applyPatchDefinition, applyPatchHandler } from "../tools/filesystem/apply_patch.js";
import { readFileDefinition, readFileHandler } from "../tools/filesystem/read_file.js";
import {
  readFileSectionDefinition,
  readFileSectionHandler,
} from "../tools/filesystem/read_file_section.js";
import { searchFilesDefinition, searchFilesHandler } from "../tools/filesystem/search_files.js";
import {
  listDirectoryDefinition,
  listDirectoryHandler,
} from "../tools/filesystem/list_directory.js";
import { moveFileDefinition, moveFileHandler } from "../tools/filesystem/move_file.js";

// Process
import { runCommandDefinition, runCommandHandler } from "../tools/process/run_command.js";
import { runScriptDefinition, runScriptHandler } from "../tools/process/run_script.js";
import { killProcessDefinition, killProcessHandler } from "../tools/process/kill_process.js";
import {
  readProcessOutputDefinition,
  readProcessOutputHandler,
} from "../tools/process/read_process_output.js";
import { expandLogDefinition, expandLogHandler } from "../tools/process/expand_log.js";

// Git
import { gitDiffDefinition, gitDiffHandler } from "../tools/git/git_diff.js";
import { gitCommitDefinition, gitCommitHandler } from "../tools/git/git_commit.js";
import { gitBranchDefinition, gitBranchHandler } from "../tools/git/git_branch.js";
import { gitCheckoutDefinition, gitCheckoutHandler } from "../tools/git/git_checkout.js";

// Memory
import { rememberDefinition, rememberHandler } from "../tools/memory/remember.js";
import { recallDefinition, recallHandler } from "../tools/memory/recall.js";

// Checkpoint
import { checkpointDefinition, checkpointHandler } from "../tools/checkpoint/checkpoint.js";
import {
  restoreCheckpointDefinition,
  restoreCheckpointHandler,
} from "../tools/checkpoint/restore_checkpoint.js";

// Workflow
import {
  createWorkflowDefinition,
  createWorkflowHandler,
} from "../tools/workflow/create_workflow.js";
import {
  getWorkflowStateDefinition,
  getWorkflowStateHandler,
} from "../tools/workflow/get_workflow_state.js";
import { executeStepDefinition, executeStepHandler } from "../tools/workflow/execute_step.js";

// System
import {
  listCapabilitiesDefinition,
  listCapabilitiesHandler,
} from "../tools/system/list_capabilities.js";
import { invokeDefinition, invokeHandler } from "../tools/system/invoke.js";
import { askUserDefinition, askUserHandler } from "../tools/system/ask_user.js";
import {
  detectWorkspaceDefinition,
  detectWorkspaceHandler,
} from "../tools/system/detect_workspace.js";
import { openProjectDefinition, openProjectHandler } from "../tools/system/open_project.js";

/**
 * Registers all capabilities in the router registry.
 * This should be run once during application initialization.
 */
export function registerAllCapabilities(): void {
  // Filesystem
  registerCapability(applyPatchDefinition, applyPatchHandler);
  registerCapability(readFileDefinition, readFileHandler);
  registerCapability(readFileSectionDefinition, readFileSectionHandler);
  registerCapability(searchFilesDefinition, searchFilesHandler);
  registerCapability(listDirectoryDefinition, listDirectoryHandler);
  registerCapability(moveFileDefinition, moveFileHandler);

  // Process
  registerCapability(runCommandDefinition, runCommandHandler);
  registerCapability(runScriptDefinition, runScriptHandler);
  registerCapability(killProcessDefinition, killProcessHandler);
  registerCapability(readProcessOutputDefinition, readProcessOutputHandler);
  registerCapability(expandLogDefinition, expandLogHandler);

  // Git
  registerCapability(gitDiffDefinition, gitDiffHandler);
  registerCapability(gitCommitDefinition, gitCommitHandler);
  registerCapability(gitBranchDefinition, gitBranchHandler);
  registerCapability(gitCheckoutDefinition, gitCheckoutHandler);

  // Memory
  registerCapability(rememberDefinition, rememberHandler);
  registerCapability(recallDefinition, recallHandler);

  // Checkpoint
  registerCapability(checkpointDefinition, checkpointHandler);
  registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);

  // Workflow
  registerCapability(createWorkflowDefinition, createWorkflowHandler);
  registerCapability(getWorkflowStateDefinition, getWorkflowStateHandler);
  registerCapability(executeStepDefinition, executeStepHandler);

  // System
  registerCapability(listCapabilitiesDefinition, listCapabilitiesHandler);
  registerCapability(invokeDefinition, invokeHandler);
  registerCapability(askUserDefinition, askUserHandler);
  registerCapability(detectWorkspaceDefinition, detectWorkspaceHandler);
  registerCapability(openProjectDefinition, openProjectHandler);
}
