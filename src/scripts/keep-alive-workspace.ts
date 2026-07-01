import process from "node:process";
import { createCloudStudioClient } from "../cloudstudio/client";
import { loadRuntimeConfig } from "../config/runtime-env";
import { runKeepAlive } from "../keep-alive/keep-alive-runner";

async function main() {
  const config = loadRuntimeConfig();
  const client = createCloudStudioClient(config.cloudStudio);

  await runKeepAlive(client, config);
}

main().catch((error) => {
  console.error("Main Error:", error);
  process.exit(1);
});
