import {
  createCloudStudioHttpApi,
  type CloudStudioHttpApi,
} from "./cloudstudio/cloudstudio-http-api";
import { createCloudStudioClient } from "./cloudstudio/client";
import { loadRuntimeConfig } from "./config/runtime-env";

export { createCloudStudioHttpApi } from "./cloudstudio/cloudstudio-http-api";
export type { WorkspaceStatus } from "./cloudstudio/cloudstudio-http-api";

let legacyApi: Promise<CloudStudioHttpApi> | undefined;

async function getLegacyApi() {
  if (!legacyApi) {
    const { cloudStudio } = loadRuntimeConfig();
    const client = createCloudStudioClient(cloudStudio);
    legacyApi = createCloudStudioHttpApi(client, cloudStudio.spaceKey);
  }

  return legacyApi;
}

export async function getAccessToken(spaceKey: string) {
  return (await getLegacyApi()).getAccessToken(spaceKey);
}

export async function getWorkspaceStatus() {
  return (await getLegacyApi()).getWorkspaceStatus();
}
