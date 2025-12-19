import { Octokit } from "@octokit/rest";

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string,
  ref: string,
  token: string
) {
  const octokit = new Octokit({ auth: token });

  console.log(
    `Triggering workflow ${workflowId} in ${owner}/${repo} on branch ${ref}...`
  );

  try {
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
    });
    console.log("Workflow dispatch request sent.");
  } catch (error) {
    console.error("Failed to trigger workflow:", error);
    throw error;
  }
}
