# Multi-Account Keepalive Controller Design

Date: 2026-07-01

## Context

This project currently keeps one Tencent Cloud CloudStudio workspace alive by combining GitHub Actions, Tencent Cloud SDK calls, SSH, and a Cloudflare Worker scheduler. The current shape works for a single account and one target service, but it has three practical limits:

- It cannot safely control multiple Tencent Cloud accounts or multiple workspaces.
- Secrets and configuration are split between GitHub and Cloudflare.
- It lacks a complete control surface for status, manual actions, retries, locking, and notifications.

The chosen direction is a personal multi-account controller with GitHub as the main configuration and secret center. Cloudflare remains a lightweight scheduler and manual trigger proxy.

## Goals

- Support multiple Tencent Cloud accounts.
- Support multiple workspaces per account.
- Enforce the rule that one account can only use one running workspace at a time.
- Allow per-account switching behavior through `switchPolicy`.
- Centralize Tencent Cloud and workspace configuration in GitHub.
- Keep Cloudflare configuration minimal.
- Add status reporting, manual control, reliability protections, and notification hooks.
- Keep the first version usable without a web UI.

## Non-Goals

- No team permission model.
- No full web dashboard in the first implementation.
- No database-backed control plane.
- No migration to Cloudflare as the main secret store.
- No automatic discovery-only workflow that operates on unknown accounts without explicit configuration.

## Recommended Architecture

Use GitHub Actions as the control plane and execution environment. Cloudflare Worker triggers the GitHub workflow on a schedule or through a manual HTTP endpoint.

The new GitHub workflow runs a TypeScript orchestrator. The orchestrator loads account and workspace configuration, validates it, applies account-level constraints, executes the requested action, records a summary, and sends notifications when needed.

Main modules:

- `ConfigLoader`: reads and validates controller configuration from GitHub environment variables.
- `CloudStudioProvider`: wraps Tencent Cloud CloudStudio SDK calls for one account.
- `WorkspaceController`: applies account/workspace policy and maps actions to provider operations.
- `KeepAliveRunner`: connects to a workspace through SSH and starts or checks the configured service.
- `StateReporter`: writes a GitHub Actions summary and structured JSON output.
- `Notifier`: sends optional failure, recovery, and switch notifications.
- `Orchestrator`: coordinates all modules for one workflow run.

## Configuration

First version uses one GitHub secret:

- `KEEPALIVE_CONFIG_JSON`

Cloudflare keeps only:

- `GITHUB_REPO`
- `GITHUB_TOKEN`
- `WORKFLOW_FILE`
- `GITHUB_BRANCH` optionally

Example GitHub secret:

```json
{
  "defaults": {
    "action": "keep-alive",
    "notifyOn": ["failure", "recovery", "switch"]
  },
  "accounts": [
    {
      "id": "main",
      "name": "Main Tencent Account",
      "secretId": "AKID...",
      "secretKey": "...",
      "region": "ap-shanghai",
      "switchPolicy": "skip",
      "workspaces": [
        {
          "id": "alist",
          "name": "Alist",
          "spaceKey": "xxx",
          "cwd": "/workspace/programming-language-demo",
          "command": "pnpm alist",
          "healthCheck": {
            "type": "port",
            "port": 5244
          },
          "enabled": true
        }
      ]
    }
  ],
  "notifications": {
    "telegram": {
      "enabled": false,
      "botToken": "",
      "chatId": ""
    },
    "webhook": {
      "enabled": false,
      "url": ""
    }
  }
}
```

`switchPolicy` values:

- `skip`: if another workspace in the same account is already running, leave it running and mark the target action as skipped.
- `stop-and-start`: stop the currently running workspace, then start the requested target workspace.

The first implementation should reject ambiguous configuration:

- Duplicate account ids.
- Duplicate workspace ids within one account.
- Missing account credentials.
- Missing workspace `spaceKey`.
- Missing keep-alive command or health check.
- Invalid `switchPolicy`.

## Workflow Inputs

The GitHub workflow should support manual inputs:

- `action`: `status`, `start`, `stop`, `keep-alive`, or `switch`.
- `account`: optional account id.
- `workspace`: optional workspace id.
- `dryRun`: optional boolean.

Behavior:

- If `account` and `workspace` are provided, operate on exactly that target.
- If only `account` is provided, operate on enabled workspaces for that account where the action makes sense.
- If neither is provided during scheduled `keep-alive`, operate on all enabled workspaces according to their account policies.
- For manual destructive actions such as `stop` and `switch`, require explicit `account` and `workspace`.

## Action Semantics

`status`:

- Lists configured accounts and workspaces.
- Reads current workspace states from CloudStudio.
- Does not start or stop anything.

`start`:

- Starts the target workspace if it is stopped.
- If another workspace in the account is running, applies `switchPolicy`.
- Does not run the service command. Use `keep-alive` when the service process should also be checked or started.

`stop`:

- Stops the target workspace if supported by the CloudStudio API.
- If stop is unavailable or unsupported, reports a clear unsupported action.

`keep-alive`:

- Ensures the target workspace is available according to `switchPolicy`.
- Connects over SSH.
- Runs the configured health check.
- Starts the configured command if health check fails.

`switch`:

- Explicitly moves the account to the requested workspace.
- Uses the account `switchPolicy`. With `skip`, a conflicting running workspace is left untouched. With `stop-and-start`, the controller stops the running workspace and starts the target.

## Same-Account Workspace Constraint

Before starting or keeping a workspace alive, the controller queries all workspaces visible to that account.

If the target workspace is already running, continue.

If no workspace is running, start the target workspace.

If another workspace is running:

- `skip`: do not modify anything. Report `skipped_conflict`.
- `stop-and-start`: stop the running workspace, wait until it is stopped, then start the target workspace.

This check happens inside `WorkspaceController`, not in the workflow file, so the rule is tested in TypeScript and stays consistent across actions.

## Reliability

Add these protections in the first implementation:

- Per-account lock inside one orchestrator run to avoid parallel operations against the same account.
- GitHub Actions workflow `concurrency` key to avoid overlapping scheduled runs.
- Operation timeouts for SDK calls, SSH connect, health checks, and service startup.
- Bounded retries with small backoff for transient SDK and SSH failures.
- Structured failure reasons such as `config_error`, `workspace_conflict`, `ssh_timeout`, `healthcheck_failed`, and `command_failed`.

GitHub Actions concurrency should be configured at workflow level:

```yaml
concurrency:
  group: keepalive-controller
  cancel-in-progress: false
```

## Observability

Each run writes:

- A GitHub Actions summary table.
- A JSON result file uploaded as an artifact.
- Console logs with account/workspace ids, not raw secrets.

Summary columns:

- Account
- Workspace
- Action
- Result
- Previous state
- Final state
- Duration
- Message

Results:

- `success`
- `skipped`
- `failed`
- `dry_run`

## Notifications

Notifications are optional and configured in `KEEPALIVE_CONFIG_JSON`.

First version supports generic webhook and leaves room for Telegram or enterprise messaging adapters.

Notify only on meaningful events:

- Failure.
- Recovery after previous failure, if prior state is available.
- Automatic switch caused by `stop-and-start`.

If no durable state store exists yet, recovery detection can be deferred. Failure and switch notifications do not require prior state.

## Cloudflare Worker Role

Cloudflare Worker remains small:

- `/health` returns Worker health.
- `POST /trigger` triggers the GitHub workflow.
- Scheduled event triggers the same workflow.

It does not store Tencent Cloud credentials and does not implement account/workspace logic.

Cloudflare request body can optionally pass workflow inputs:

```json
{
  "action": "keep-alive",
  "account": "main",
  "workspace": "alist"
}
```

If no body is provided, the Worker triggers the workflow with default scheduled behavior.

## 迁移计划

1. 新增配置 schema 和配置校验逻辑。
2. 新增按账号创建的 CloudStudio provider，让每个腾讯云账号使用自己的凭据和区域配置。
3. 将现有单工作区逻辑迁移到 `WorkspaceController` 和 `KeepAliveRunner` 后面，先复用当前 alist 保活能力。
4. 用一个统一的 controller 入口替换当前分散的 workflow 脚本入口。
5. 只对 Cloudflare Worker 做必要更新，让它可以传递可选的 workflow 输入，不承载账号和工作区控制逻辑。
6. 增加 GitHub Actions summary、JSON artifact 和通知能力。
7. 迁移期间保留旧脚本，直到新 controller 能稳定跑通当前单账号 alist 场景后再移除。

## Testing Strategy

Unit tests:

- Config validation.
- Target selection from workflow inputs.
- `switchPolicy` behavior.
- Result aggregation.
- Notification event selection.

Integration-style tests with mocks:

- Start stopped target workspace.
- Skip when another workspace is running and policy is `skip`.
- Stop old workspace and start target with `stop-and-start`.
- SSH health check passes.
- SSH health check fails and command starts.

Manual verification:

- Run `status` for current single-account configuration.
- Run `keep-alive` for current alist workspace.
- Trigger through Cloudflare `/trigger`.
- Confirm GitHub summary and artifact are produced.

## Acceptance Criteria

- One GitHub secret can describe multiple accounts and workspaces.
- Cloudflare no longer needs Tencent Cloud credentials.
- Manual workflow dispatch can target one account and workspace.
- Scheduled workflow can process all enabled targets.
- The controller never starts a second workspace in the same account without applying `switchPolicy`.
- `skip` conflicts are visible in the run summary.
- `stop-and-start` conflicts are visible and notify when notifications are enabled.
- Existing single-account alist keep-alive behavior still works.
- Secrets are not printed in logs, summaries, artifacts, or notifications.
