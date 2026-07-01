# Project Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reorganize the current single-account CloudStudio keep-alive project into focused, maintainable modules without changing behavior.

**Architecture:** Split Node-side code into configuration, CloudStudio access, GitHub workflow dispatch, SSH/Alist keep-alive orchestration, and script entrypoints. Split the Cloudflare Worker into environment validation, HTTP app, GitHub dispatch, scheduled handler, and response types.

**Tech Stack:** TypeScript, tsx, Tencent Cloud CloudStudio SDK, ssh2, Octokit, Hono, Cloudflare Workers, Wrangler.

---

### Task 1: Create shared configuration and error boundaries

**Files:**
- Create: `src/shared/errors.ts`
- Create: `src/config/github-actions-env.ts`
- Create: `src/config/runtime-env.ts`
- Modify: `tsconfig.json`
- Modify: `package.json`

- [x] **Step 1: Add typed configuration errors**

Create `src/shared/errors.ts` with `ConfigurationError` for missing or invalid environment values.

- [x] **Step 2: Add GitHub environment parser**

Create `src/config/github-actions-env.ts` to derive repository owner, repository name, and branch from `GITHUB_REPOSITORY` and `GITHUB_REF_NAME`.

- [x] **Step 3: Add runtime config loader**

Create `src/config/runtime-env.ts` with `loadRuntimeConfig()` returning CloudStudio config and optional GitHub fallback config. Required values are `SECRET_ID`, `SECRET_KEY`, and `ALIST_SPACE_KEY`.

- [x] **Step 4: Add typecheck script**

Add `"typecheck": "tsc --noEmit"` to `package.json`.

### Task 2: Split CloudStudio access

**Files:**
- Create: `src/cloudstudio/client.ts`
- Create: `src/cloudstudio/cloudstudio-http-api.ts`
- Create: `src/cloudstudio/workspace-service.ts`
- Replace: `src/client.ts`
- Replace: `src/api.ts`

- [x] **Step 1: Move SDK client creation**

Create `createCloudStudioClient(config)` in `src/cloudstudio/client.ts`.

- [x] **Step 2: Move CloudStudio HTTP calls**

Create `createCloudStudioHttpApi(client, spaceKey)` in `src/cloudstudio/cloudstudio-http-api.ts`. Token creation must happen inside this factory, not at import time.

- [x] **Step 3: Move workspace start logic**

Create `startWorkspaceIfNeeded(client, spaceKey)` in `src/cloudstudio/workspace-service.ts`.

- [x] **Step 4: Keep compatibility wrappers**

Replace old `src/client.ts` and `src/api.ts` with thin re-exports so existing imports do not break during migration.

### Task 3: Split keep-alive orchestration

**Files:**
- Create: `src/shared/command-result.ts`
- Create: `src/keep-alive/ssh-target.ts`
- Create: `src/keep-alive/ssh-executor.ts`
- Create: `src/keep-alive/alist-service.ts`
- Create: `src/keep-alive/keep-alive-runner.ts`
- Replace: `src/github.ts`
- Replace: `src/keep-alive.ts`

- [x] **Step 1: Add SSH command result type**

Create `src/shared/command-result.ts` for command output structure.

- [x] **Step 2: Extract SSH target construction**

Create `buildWorkspaceSshTarget()` in `src/keep-alive/ssh-target.ts`.

- [x] **Step 3: Extract SSH executor**

Create `connectAndRun()` and `execSshCommand()` in `src/keep-alive/ssh-executor.ts`.

- [x] **Step 4: Extract Alist behavior**

Create `ensureAlistRunning()` in `src/keep-alive/alist-service.ts`.

- [x] **Step 5: Extract runner orchestration**

Create `runKeepAlive()` in `src/keep-alive/keep-alive-runner.ts`.

- [x] **Step 6: Move GitHub dispatch helper**

Create `src/github/workflow-dispatcher.ts` and replace `src/github.ts` with a compatibility re-export.

### Task 4: Introduce script entrypoints and compatibility wrappers

**Files:**
- Create: `src/scripts/deploy-workspace.ts`
- Create: `src/scripts/keep-alive-workspace.ts`
- Replace: `src/deploy.ts`
- Replace: `src/keep-alive.ts`
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/keep-alive.yml`

- [x] **Step 1: Add deploy script entry**

Create `src/scripts/deploy-workspace.ts` to load config, create the client, and call `startWorkspaceIfNeeded()`.

- [x] **Step 2: Add keep-alive script entry**

Create `src/scripts/keep-alive-workspace.ts` to load config and call `runKeepAlive()`.

- [x] **Step 3: Preserve old entrypoints**

Replace `src/deploy.ts` and `src/keep-alive.ts` with imports of the new script files.

- [x] **Step 4: Update scripts and workflows**

Point package scripts and GitHub Actions commands to the new script entry files while keeping wrappers usable.

### Task 5: Split Cloudflare Worker

**Files:**
- Create: `worker/env.ts`
- Create: `worker/responses.ts`
- Create: `worker/github-workflow.ts`
- Create: `worker/app.ts`
- Create: `worker/scheduled.ts`
- Create: `worker/index.ts`
- Replace: `worker/keep-alive.ts`
- Modify: `wrangler.toml`

- [x] **Step 1: Extract Worker env validation**

Create `worker/env.ts` with `getWorkerConfig(env)`.

- [x] **Step 2: Extract response types**

Create `worker/responses.ts` for success and error response interfaces.

- [x] **Step 3: Extract GitHub workflow dispatch**

Create `worker/github-workflow.ts` with `triggerWorkflow(env)`.

- [x] **Step 4: Extract Hono app**

Create `worker/app.ts` with `/health`, `/trigger`, not-found, and error handling routes.

- [x] **Step 5: Extract scheduled handler and entrypoint**

Create `worker/scheduled.ts` and `worker/index.ts`, then update `wrangler.toml` to `main = "worker/index.ts"`.

- [x] **Step 6: Preserve old Worker file**

Replace `worker/keep-alive.ts` with a compatibility re-export from `worker/index.ts`.

### Task 6: Update Chinese documentation

**Files:**
- Modify: `README.md`
- Modify: `worker/README.md`

- [x] **Step 1: Document new structure**

Add a source layout section to the root README.

- [x] **Step 2: Document compatibility entries**

Explain that old entry files still forward to new scripts.

- [x] **Step 3: Document behavior tuning points**

Point readers to `src/keep-alive/alist-service.ts` for port, working directory, and start command changes.

### Task 7: Verify

**Files:**
- All changed files.

- [x] **Step 1: Run typecheck**

Run `npm run typecheck`. Expected: pass.

- [x] **Step 2: Run deploy entry without credentials**

Run `env -u SECRET_ID -u SECRET_KEY -u ALIST_SPACE_KEY npm run deploy`. Expected: clear missing environment variable error.

- [x] **Step 3: Run keep-alive entry without credentials**

Run `env -u SECRET_ID -u SECRET_KEY -u ALIST_SPACE_KEY npx tsx src/keep-alive.ts`. Expected: clear missing environment variable error.

- [x] **Step 4: Inspect git diff**

Run `git diff --stat` and `git status --short`. Expected: only planned refactor, docs, scripts, and workflow files changed.
