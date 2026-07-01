import type { CloudStudioClient } from "./client";

interface BaseResponse<T> {
  code: number;
  semanticization: "success" | "error";
  msg: string;
  data: T;
}

type GetAccessTokenResponse = BaseResponse<string>;

export interface WorkspaceStatus {
  id: number;
  name: string;
  spaceKey: string;
  status: "running" | "stopped";
  description: string;
  clusterId: string;
}

type GetWorkspaceStatusResponse = BaseResponse<WorkspaceStatus[]>;

export interface CloudStudioHttpApi {
  getAccessToken(spaceKey: string): Promise<string>;
  getWorkspaceStatus(): Promise<WorkspaceStatus[]>;
}

export async function createCloudStudioHttpApi(
  client: CloudStudioClient,
  spaceKey: string
): Promise<CloudStudioHttpApi> {
  // CloudStudio HTTP APIs require a short-lived workspace token. Creating it
  // inside this factory keeps imports side-effect free and network-free.
  const { Token } = await client.CreateWorkspaceToken({
    SpaceKey: spaceKey,
    Policies: ["all"],
  });

  const headers = {
    Authorization: `${Token}`,
  };

  return {
    async getAccessToken(targetSpaceKey: string) {
      const response = await fetch(
        `https://ide.cloud.tencent.com/api/user/get-access-token-for-space?spaceKey=${targetSpaceKey}`,
        { headers }
      );
      const { data, semanticization, msg } =
        (await response.json()) as GetAccessTokenResponse;

      if (semanticization === "error") {
        throw new Error(`Get access token failed: ${msg}`);
      }

      return data;
    },

    async getWorkspaceStatus() {
      const response = await fetch(
        "https://ide.cloud.tencent.com/api/workspace/status/list",
        { headers }
      );
      const { data, semanticization, msg } =
        (await response.json()) as GetWorkspaceStatusResponse;

      if (semanticization === "error") {
        throw new Error(`Get workspace status failed: ${msg}`);
      }

      return data;
    },
  };
}
