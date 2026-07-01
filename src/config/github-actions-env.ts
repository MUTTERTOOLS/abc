export interface GitHubRepositoryInfo {
  owner: string;
  repo: string;
  branch: string;
}

export function parseGitHubRepositoryInfo(
  repository?: string,
  refName?: string
): GitHubRepositoryInfo | undefined {
  if (!repository) {
    return undefined;
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    return undefined;
  }

  return {
    owner,
    repo,
    branch: refName || "main",
  };
}
