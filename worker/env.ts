export interface WorkerEnv {
  GITHUB_REPO: string;
  GITHUB_TOKEN: string;
  WORKFLOW_FILE: string;
  GITHUB_BRANCH?: string;
  KEEP_ALIVE_KV?: KVNamespace;
}

export interface WorkerConfig {
  repo: string;
  token: string;
  workflowFile: string;
  branch: string;
}

export function getWorkerConfig(env: WorkerEnv): WorkerConfig {
  if (!env.GITHUB_REPO) {
    throw new Error("GITHUB_REPO environment variable is required");
  }
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  if (!env.WORKFLOW_FILE) {
    throw new Error("WORKFLOW_FILE environment variable is required");
  }

  return {
    repo: env.GITHUB_REPO,
    token: env.GITHUB_TOKEN,
    workflowFile: env.WORKFLOW_FILE,
    branch: env.GITHUB_BRANCH || "main",
  };
}
