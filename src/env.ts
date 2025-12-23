import process from "node:process";
// Tencent Cloud SecretId and SecretKey
export const SECRET_ID = process.env.SECRET_ID;
export const SECRET_KEY = process.env.SECRET_KEY;
// workspace key
export const ALIST_SPACE_KEY = process.env.ALIST_SPACE_KEY;
// SSH URL
export const SSH_URL = process.env.SSH_URL;
// GITHUB personal access token
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// GitHub Actions 默认提供的环境变量
// GITHUB_TOKEN 需要在 workflow yaml 中显式传递 env
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
export const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME;

export const REPO_OWNER = GITHUB_REPOSITORY?.split("/")[0];
export const REPO_NAME = GITHUB_REPOSITORY?.split("/")[1];
export const REPO_BRANCH = GITHUB_REF_NAME || "main";

if (!SECRET_ID || !SECRET_KEY || !ALIST_SPACE_KEY) {
  throw new Error("Missing environment variables");
}
