import process from "node:process";
import { parseGitHubRepositoryInfo } from "./github-actions-env";
import { ConfigurationError } from "../shared/errors";

export interface CloudStudioConfig {
  secretId: string;
  secretKey: string;
  spaceKey: string;
}

export interface GitHubFallbackConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface RuntimeConfig {
  cloudStudio: CloudStudioConfig;
  githubFallback?: GitHubFallbackConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const cloudStudio: CloudStudioConfig = {
    secretId: requireEnv("SECRET_ID"),
    secretKey: requireEnv("SECRET_KEY"),
    spaceKey: requireEnv("ALIST_SPACE_KEY"),
  };

  const repositoryInfo = parseGitHubRepositoryInfo(
    process.env.GITHUB_REPOSITORY,
    process.env.GITHUB_REF_NAME
  );
  const token = process.env.GITHUB_TOKEN;

  return {
    cloudStudio,
    githubFallback:
      token && repositoryInfo
        ? {
            token,
            owner: repositoryInfo.owner,
            repo: repositoryInfo.repo,
            branch: repositoryInfo.branch,
          }
        : undefined,
  };
}
