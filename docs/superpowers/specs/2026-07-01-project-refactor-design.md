# Project Refactor Design

Date: 2026-07-01

## Context

The project currently keeps one Tencent Cloud CloudStudio workspace alive by combining GitHub Actions, Tencent Cloud SDK calls, SSH commands, and a Cloudflare Worker scheduler. The current code works, but responsibilities are mixed across a small set of files:

- `src/env.ts` reads and validates environment variables at module import time.
- `src/api.ts` both creates a CloudStudio workspace token and calls CloudStudio HTTP APIs.
- `src/keep-alive.ts` performs orchestration, SSH connection management, command execution, port checks, and fallback GitHub workflow dispatch in one file.
- `worker/keep-alive.ts` contains Worker environment types, HTTP routes, GitHub dispatch logic, scheduled handling, and response types in one file.

The repository also contains a separate multi-account design document. This refactor does not implement that future controller. It creates a clean single-account structure that can safely support future expansion.

## Goals

- Keep current single-account, single-workspace behavior intact.
- Make directory structure and file naming clear enough to understand the system by scanning the tree.
- Separate configuration, CloudStudio access, GitHub workflow dispatch, SSH execution, keep-alive orchestration, and Worker routing.
- Avoid reading `process.env` from business logic modules.
- Keep existing public entry points compatible where practical.
- Add comments at architectural boundaries and non-obvious behavior.
- Update documentation and scripts to match the new layout.
- Add TypeScript verification so structural regressions are caught without needing live credentials.

## Non-Goals

- Do not implement multi-account configuration.
- Do not add a web dashboard.
- Do not add durable state, notification adapters, or switch policies.
- Do not change the current Alist command, health-check port, or CloudStudio region unless required for structure.
- Do not change Cloudflare Worker behavior beyond file organization and clearer validation.

## Proposed Structure

```text
src/
  cloudstudio/
    client.ts
    cloudstudio-http-api.ts
    workspace-service.ts
  config/
    github-actions-env.ts
    runtime-env.ts
  github/
    workflow-dispatcher.ts
  keep-alive/
    alist-service.ts
    keep-alive-runner.ts
    ssh-executor.ts
    ssh-target.ts
  scripts/
    deploy-workspace.ts
    keep-alive-workspace.ts
  shared/
    command-result.ts
    errors.ts

worker/
  app.ts
  env.ts
  github-workflow.ts
  index.ts
  responses.ts
  scheduled.ts
```

Compatibility wrappers remain:

- `src/deploy.ts` imports `src/scripts/deploy-workspace.ts`.
- `src/keep-alive.ts` imports `src/scripts/keep-alive-workspace.ts`.

This lets existing workflows continue to run while package scripts can move to clearer script entry names.

## Runtime Configuration

`src/config/runtime-env.ts` reads local and GitHub Actions environment variables once and returns typed configuration objects:

- CloudStudio credentials: `SECRET_ID`, `SECRET_KEY`, `ALIST_SPACE_KEY`.
- Optional GitHub fallback dispatch settings: `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_REF_NAME`.

The module throws a clear configuration error when required CloudStudio values are missing. Business modules receive configuration as function arguments instead of importing environment constants.

`src/config/github-actions-env.ts` derives repository owner, repository name, and branch from GitHub Actions environment values.

## CloudStudio Modules

`src/cloudstudio/client.ts` creates the Tencent CloudStudio SDK client from explicit credentials.

`src/cloudstudio/workspace-service.ts` exposes workspace operations:

- list workspaces through the SDK.
- find a workspace by `spaceKey`.
- start a stopped workspace.
- return structured start results such as `already_running`, `started`, `invalid`, and `unknown`.

`src/cloudstudio/cloudstudio-http-api.ts` wraps CloudStudio HTTP endpoints that require a workspace token:

- get workspace access token.
- get workspace status list.

The token is created inside a factory function instead of at module import time, so imports do not perform network requests.

## Keep-Alive Modules

`src/keep-alive/ssh-target.ts` converts CloudStudio workspace status and access token into the SSH target:

```text
{accessToken}@{spaceKey}.{clusterId}.ssh.cloudstudio.work
```

`src/keep-alive/ssh-executor.ts` owns SSH connection lifecycle and command execution. It keeps the existing keyboard-interactive behavior because CloudStudio SSH does not require a password in this setup.

`src/keep-alive/alist-service.ts` owns Alist-specific health check and start commands:

- health check: port `5244`.
- working directory: `/workspace/programming-language-demo`.
- start command: `nohup pnpm alist >/dev/null 2>&1 &`.

`src/keep-alive/keep-alive-runner.ts` orchestrates the flow:

1. get access token.
2. find workspace status.
3. build SSH target.
4. connect over SSH.
5. check Alist port.
6. skip start when the port is already in use.
7. start Alist when the port is free.
8. trigger `deploy.yml` on SSH failure when GitHub dispatch settings are available.

## GitHub Modules

`src/github/workflow-dispatcher.ts` contains the Node-side GitHub workflow dispatch helper. It accepts owner, repository, workflow file, ref, and token explicitly.

The fallback dispatch behavior remains the same: when keep-alive fails and GitHub repository information is available, dispatch `deploy.yml` on the current branch or `main`.

## Worker Modules

`worker/index.ts` exports the Cloudflare Worker entrypoint.

`worker/app.ts` builds the Hono app and owns routes:

- `GET /health`
- `POST /trigger`
- not found
- error handler

`worker/env.ts` validates Worker environment bindings:

- `GITHUB_REPO`
- `GITHUB_TOKEN`
- `WORKFLOW_FILE`
- optional `GITHUB_BRANCH`

`worker/github-workflow.ts` triggers GitHub workflow dispatch through Octokit and formats actionable 404 errors.

`worker/scheduled.ts` owns cron behavior and calls the same trigger function as the HTTP route.

`worker/responses.ts` defines JSON response shapes.

The Worker continues to be a small trigger proxy. It does not store Tencent Cloud credentials or run CloudStudio control logic.

## Error Handling

Configuration failures use a named `ConfigurationError`.

Expected operational failures should include context without exposing secrets:

- missing workspace.
- invalid repository format.
- failed CloudStudio HTTP response.
- SSH connection failure.
- GitHub workflow dispatch failure.

Keep-alive preserves current fallback behavior by catching SSH and command execution failures around the SSH flow and attempting deploy dispatch when possible.

## Documentation Updates

Update `README.md` and `worker/README.md` to reflect:

- new source layout.
- compatible legacy entry points.
- current scripts.
- cron remains disabled until `[triggers]` is uncommented.
- where to change Alist port, working directory, and start command.

## Testing and Verification

Add a `typecheck` script:

```bash
tsc --noEmit
```

Verification commands:

```bash
npm run typecheck
npm run deploy
npx tsx src/keep-alive.ts
```

When credentials are unavailable, runtime commands are expected to fail with clear configuration errors. A successful structural refactor must not fail because of missing imports, wrong paths, or accidental network calls during module import.

## Acceptance Criteria

- Project source files are organized by responsibility, not by incidental growth.
- `src/deploy.ts` and `src/keep-alive.ts` still work as compatibility entry points.
- Package scripts point to clear script entry files.
- Worker deploy target points to the new Worker entry file.
- No business logic module reads required runtime environment variables directly at import time.
- CloudStudio token creation does not happen during import.
- Keep-alive behavior remains equivalent for the current Alist workspace.
- Worker endpoints and scheduled trigger behavior remain equivalent.
- Documentation describes the new layout in Chinese.
- TypeScript typecheck passes.
