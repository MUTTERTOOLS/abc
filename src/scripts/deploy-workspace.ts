import process from "node:process";
import { createCloudStudioClient } from "../cloudstudio/client";
import { startWorkspaceIfNeeded } from "../cloudstudio/workspace-service";
import { loadRuntimeConfig } from "../config/runtime-env";

async function main() {
  const { cloudStudio } = loadRuntimeConfig();
  const client = createCloudStudioClient(cloudStudio);
  const result = await startWorkspaceIfNeeded(client, cloudStudio.spaceKey);

  console.log(result.message);
}

main().catch((error) => {
  console.error("Deploy workspace failed:", error);
  process.exit(1);
});
