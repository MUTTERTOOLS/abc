import type { WorkspaceStatus } from "../cloudstudio/cloudstudio-http-api";

export interface SshTarget {
  username: string;
  host: string;
  port: number;
}

export function buildWorkspaceSshTarget(
  accessToken: string,
  spaceKey: string,
  workspace: WorkspaceStatus
): SshTarget {
  return {
    username: accessToken,
    host: `${spaceKey}.${workspace.clusterId}.ssh.cloudstudio.work`,
    port: 22,
  };
}
