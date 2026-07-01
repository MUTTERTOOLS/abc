import { Octokit } from "@octokit/rest";

export interface WorkflowDispatchOptions {
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
  token: string;
}

export async function triggerWorkflow(options: WorkflowDispatchOptions) {
  const octokit = new Octokit({ auth: options.token });

  console.log(
    `Triggering workflow ${options.workflowId} in ${options.owner}/${options.repo} on branch ${options.ref}...`
  );

  try {
    await octokit.actions.createWorkflowDispatch({
      owner: options.owner,
      repo: options.repo,
      workflow_id: options.workflowId,
      ref: options.ref,
    });
    console.log("Workflow dispatch request sent.");
  } catch (error) {
    console.error("Failed to trigger workflow:", error);
    throw error;
  }
}
