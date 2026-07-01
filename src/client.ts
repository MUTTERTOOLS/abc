import { createCloudStudioClient } from "./cloudstudio/client";
import { loadRuntimeConfig } from "./config/runtime-env";

export { createCloudStudioClient } from "./cloudstudio/client";

// Legacy compatibility export for older imports. New code should create a
// client from explicit runtime config instead of importing this singleton.
export const client = createCloudStudioClient(loadRuntimeConfig().cloudStudio);
