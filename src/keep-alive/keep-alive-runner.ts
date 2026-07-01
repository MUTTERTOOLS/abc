import { createCloudStudioHttpApi } from "../cloudstudio/cloudstudio-http-api";
import type { CloudStudioClient } from "../cloudstudio/client";
import type { RuntimeConfig } from "../config/runtime-env";
import { triggerWorkflow } from "../github/workflow-dispatcher";
import { ensureAlistRunning } from "./alist-service";
import { withSshConnection } from "./ssh-executor";
import { buildWorkspaceSshTarget } from "./ssh-target";

export async function runKeepAlive(
  client: CloudStudioClient,
  config: RuntimeConfig
): Promise<void> {
  const { cloudStudio, githubFallback } = config;
  const api = await createCloudStudioHttpApi(client, cloudStudio.spaceKey);
  const accessToken = await api.getAccessToken(cloudStudio.spaceKey);
  const workspace = (await api.getWorkspaceStatus()).find(
    (item) => item.spaceKey === cloudStudio.spaceKey
  );

  if (!workspace) {
    throw new Error(`No workspace found for spaceKey: ${cloudStudio.spaceKey}`);
  }

  const target = buildWorkspaceSshTarget(
    accessToken,
    cloudStudio.spaceKey,
    workspace
  );

  console.log(`Connecting to ${target.username}@${target.host}:${target.port}...`);

  try {
    await withSshConnection(target, ensureAlistRunning);
  } catch (error) {
    console.error("SSH Connection/Execution failed:", error);

    // Preserve the existing self-healing path: failed SSH keep-alive attempts
    // can ask GitHub Actions to run the workspace deploy workflow.
    if (githubFallback) {
      console.log("Attempting to trigger deploy workflow...");
      await triggerWorkflow({
        owner: githubFallback.owner,
        repo: githubFallback.repo,
        workflowId: "deploy.yml",
        ref: githubFallback.branch,
        token: githubFallback.token,
      });
      console.log("Deploy dispatch request sent.");
      return;
    }

    console.error(
      "Missing GITHUB_TOKEN or repository info, cannot trigger deploy workflow."
    );
  }
}
