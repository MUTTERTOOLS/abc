import { cloudstudio } from "tencentcloud-sdk-nodejs-cloudstudio";
import process from 'node:process'

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const ALIST_SPACE_KEY = process.env.ALIST_SPACE_KEY;

if (!SECRET_ID || !SECRET_KEY || !ALIST_SPACE_KEY) {
  throw new Error("Missing environment variables");
}

enum WorkspaceStatus {
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  INVALID = "INVALID",
}

// 创建客户端对象
const client = new cloudstudio.v20230508.Client({
  credential: {
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
  },
  region: "ap-shanghai",
});

// 获取工作空间列表
const res = await client.DescribeWorkspaces({});

if (!res.Data) {
  throw new Error("No workspaces Data");
}

// 获取指定的工作空间
const alistWorkspace = res.Data.find((item) => item.SpaceKey === ALIST_SPACE_KEY);

if (!alistWorkspace?.Status) {
  throw new Error("No workspace status");
}

// 根据状态是否运行工作空间
if (alistWorkspace.Status === WorkspaceStatus.RUNNING) {
  console.log("Alist workspace is already running");
} else if (alistWorkspace.Status === WorkspaceStatus.STOPPED) {
  const runRes = await client.RunWorkspace({
    SpaceKey: ALIST_SPACE_KEY,
  });
  console.log('Alist workspace is running.')
} else if (alistWorkspace.Status === WorkspaceStatus.INVALID) {
  console.log("Alist workspace is invalid");
} else {
  console.log("Alist workspace is unknown status: " + alistWorkspace?.Status);
}
