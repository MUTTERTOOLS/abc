import { client } from "./client";
import { ALIST_SPACE_KEY } from "./env";

const token = await client.CreateWorkspaceToken({
  SpaceKey: ALIST_SPACE_KEY,
});

const headers = {
  Authorization: `${token.Token}`,
};

interface BaseResponse<T> {
  code: number;
  semanticization: "success" | "error";
  msg: string;
  data: T;
}

type GetAccessTokenResponse = BaseResponse<string>;
export async function getAccessToken(spaceKey: string) {
  const response = await fetch(
    `https://ide.cloud.tencent.com/api/user/get-access-token-for-space?spaceKey=${spaceKey}`,
    {
      headers,
    }
  );
  const { data, semanticization, msg } =
    await response.json<GetAccessTokenResponse>();

  if (semanticization === "error") {
    throw new Error(`Get access token failed: ${msg}`);
  }
  return data;
}

interface Workspace {
  id: number;
  name: string;
  spaceKey: string;
  status: "running" | "stopped";
  description: string;
  clusterId: string;
}
type GetWorkspaceStatusResponse = BaseResponse<Workspace[]>;
export async function getWorkspaceStatus() {
  const response = await fetch(
    `https://ide.cloud.tencent.com/api/workspace/status/list`,
    {
      headers,
    }
  );
  const { data, semanticization, msg } =
    await response.json<GetWorkspaceStatusResponse>();

  if (semanticization === "error") {
    throw new Error(`Get workspace status failed: ${msg}`);
  }
  return data;
}
