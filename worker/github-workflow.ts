import { Octokit } from "@octokit/rest";
import { getWorkerConfig, type WorkerEnv } from "./env";
import type { ErrorResponse, SuccessResponse } from "./responses";

async function dispatchWorkflowByName(
  repo: string,
  workflowFile: string,
  branch: string,
  token: string,
  timestamp: string
): Promise<{ success: boolean; error?: string; workflowId?: string }> {
  try {
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
    }

    const octokit = new Octokit({ auth: token });
    console.log(`[${timestamp}] Calling GitHub API via Octokit`);

    await octokit.actions.createWorkflowDispatch({
      owner,
      repo: repoName,
      workflow_id: workflowFile,
      ref: branch,
    });

    console.log(
      `[${timestamp}] Successfully triggered workflow ${workflowFile}`
    );
    return { success: true };
  } catch (error) {
    const err = error as { status?: number; message?: string };
    console.error(`[${timestamp}] Error triggering ${workflowFile}:`, err);

    if (err.status === 404) {
      return {
        success: false,
        error:
          `Workflow not found. Please check:\n` +
          `1. GITHUB_REPO is correct (format: owner/repo)\n` +
          `2. WORKFLOW_FILE is correct (filename only, e.g. "${workflowFile}")\n` +
          `3. The workflow file exists in .github/workflows/ directory\n` +
          `4. The workflow has workflow_dispatch trigger enabled\n` +
          `5. GitHub token has proper permissions\n` +
          `API Message: ${err.message}`,
      };
    }

    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function triggerWorkflow(env: WorkerEnv): Promise<Response> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Triggering keep-alive workflow`);

  const config = getWorkerConfig(env);

  console.log(
    `[${timestamp}] Config: repo=${config.repo}, workflow=${config.workflowFile}, branch=${config.branch}`
  );

  try {
    const result = await dispatchWorkflowByName(
      config.repo,
      config.workflowFile,
      config.branch,
      config.token,
      timestamp
    );

    if (result.success) {
      const successResponse: SuccessResponse = {
        success: true,
        timestamp,
        message: "Workflow triggered successfully",
        repo: config.repo,
        workflowFile: config.workflowFile,
        branch: config.branch,
        workflowId: result.workflowId,
      };
      return Response.json(successResponse);
    }

    const errorResponse: ErrorResponse = {
      success: false,
      timestamp,
      error: result.error || "Failed to trigger workflow",
      config: {
        repo: config.repo,
        workflowFile: config.workflowFile,
        branch: config.branch,
      },
    };
    return Response.json(errorResponse, { status: 500 });
  } catch (error) {
    const err = error as Error;
    console.error(`[${timestamp}] Error:`, err);

    const errorResponse: ErrorResponse = {
      success: false,
      timestamp,
      error: err.message,
      config: {
        repo: config.repo,
        workflowFile: config.workflowFile,
        branch: config.branch,
      },
    };

    return Response.json(errorResponse, { status: 500 });
  }
}
