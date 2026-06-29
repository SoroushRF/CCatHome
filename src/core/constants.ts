// Constants and Enums for CCatHome

export enum PermissionTier {
  TIER_0 = 0,
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

export enum WorkflowStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum CommandStatus {
  RUNNING = "running",
  READY = "ready",
  EXITED = "exited",
  KILLED = "killed",
}

export enum CapabilityName {
  // Tier A
  INVOKE = "invoke",
  LIST_CAPABILITIES = "list_capabilities",
  EXECUTE_STEP = "execute_step",
  RUN_SCRIPT = "run_script",
  READ_FILE = "read_file",
  APPLY_PATCH = "apply_patch",
  RUN_COMMAND = "run_command",
  DETECT_WORKSPACE = "detect_workspace",
  CREATE_WORKFLOW = "create_workflow",
  GET_WORKFLOW_STATE = "get_workflow_state",
  ASK_USER = "ask_user",
  OPEN_PROJECT = "open_project",

  // Tier B
  SEARCH_FILES = "search_files",
  LIST_DIRECTORY = "list_directory",
  MOVE_FILE = "move_file",
  READ_FILE_SECTION = "read_file_section",
  KILL_PROCESS = "kill_process",
  READ_PROCESS_OUTPUT = "read_process_output",
  EXPAND_LOG = "expand_log",
  GIT_DIFF = "git_diff",
  GIT_COMMIT = "git_commit",
  GIT_BRANCH = "git_branch",
  GIT_CHECKOUT = "git_checkout",
  REMEMBER = "remember",
  RECALL = "recall",
  CHECKPOINT = "checkpoint",
  RESTORE_CHECKPOINT = "restore_checkpoint",
}
