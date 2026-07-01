import type { CloudStudioClient } from "./client";

export enum WorkspaceStatusCode {
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  INVALID = "INVALID",
}

export type WorkspaceStartResult =
  | { status: "already_running"; message: string }
  | { status: "started"; message: string }
  | { status: "invalid"; message: string }
  | { status: "unknown"; message: string };

export async function startWorkspaceIfNeeded(
  client: CloudStudioClient,
  spaceKey: string
): Promise<WorkspaceStartResult> {
  const response = await client.DescribeWorkspaces({});

  if (!response.Data) {
    throw new Error("No workspaces data returned by CloudStudio");
  }

  const workspace = response.Data.find((item) => item.SpaceKey === spaceKey);

  if (!workspace?.Status) {
    throw new Error(`No workspace status found for spaceKey: ${spaceKey}`);
  }

  if (workspace.Status === WorkspaceStatusCode.RUNNING) {
    return {
      status: "already_running",
      message: "Alist workspace is already running",
    };
  }

  if (workspace.Status === WorkspaceStatusCode.STOPPED) {
    await client.RunWorkspace({ SpaceKey: spaceKey });
    return {
      status: "started",
      message: "Alist workspace is running.",
    };
  }

  if (workspace.Status === WorkspaceStatusCode.INVALID) {
    return {
      status: "invalid",
      message: "Alist workspace is invalid",
    };
  }

  return {
    status: "unknown",
    message: `Alist workspace is unknown status: ${workspace.Status}`,
  };
}
