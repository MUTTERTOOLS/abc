import { cloudstudio } from "tencentcloud-sdk-nodejs-cloudstudio";

declare const SecretId: string;
declare const SecretKey: string;
declare const AlistSpaceKey: string;

enum WorkspaceStatus {
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  INVALID = "INVALID",
}

const client = new cloudstudio.v20230508.Client({
  credential: {
    secretId: SecretId,
    secretKey: SecretKey,
  },
  region: "ap-shanghai",
});

const res = await client.DescribeWorkspaces({});

if (!res.Data) {
  throw new Error("No workspaces Data");
}

const alistWorkspace = res.Data.find((item) => item.SpaceKey === AlistSpaceKey);

if (!alistWorkspace?.Status) {
  throw new Error("No workspace status");
}

if (alistWorkspace.Status === WorkspaceStatus.RUNNING) {
  console.log("Alist workspace is already running");
} else if (alistWorkspace.Status === WorkspaceStatus.STOPPED) {
  const runRes = await client.RunWorkspace({
    SpaceKey: AlistSpaceKey,
  });
} else if (alistWorkspace.Status === WorkspaceStatus.INVALID) {
  console.log("Alist workspace is invalid");
} else {
  console.log("Alist workspace is unknown status: " + alistWorkspace?.Status);
}
