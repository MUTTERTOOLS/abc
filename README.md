# CloudStudio Alist 保活项目

这个项目用于让腾讯 CloudStudio 工作区保持可用，并在工作区内检查和启动 Alist 服务。当前实现由两部分组成：

- GitHub Actions：执行腾讯云 CloudStudio API 调用、SSH 保活和服务启动。
- Cloudflare Worker：按定时任务或手动 HTTP 请求触发 GitHub Actions。

> 说明：`docs/superpowers/specs/2026-07-01-multi-account-keepalive-design.md` 是多账号控制器的设计文档，当前代码仍是单账号、单工作区保活实现。

## 工作流程

推荐运行链路如下：

1. Cloudflare Worker 按 cron 定时触发 GitHub workflow。
2. GitHub Actions 运行 `src/scripts/keep-alive-workspace.ts`。
3. 脚本通过腾讯 CloudStudio API 获取工作区状态和 SSH 信息。
4. 脚本 SSH 连接到工作区，检查 `5244` 端口。
5. 如果 `5244` 端口已被占用，认为 Alist 已在运行。
6. 如果 `5244` 端口未被占用，执行 `pnpm alist` 在后台启动服务。
7. 如果 SSH 保活失败，并且 GitHub 环境变量完整，脚本会尝试触发 `deploy.yml` 启动工作区。

## 目录结构

重构后的代码按职责拆分：

```text
src/
  cloudstudio/     # 腾讯 CloudStudio SDK 与 HTTP API 封装
  config/          # 环境变量读取、校验和 GitHub Actions 环境解析
  github/          # GitHub workflow_dispatch 调用
  keep-alive/      # SSH 连接、端口检查和 Alist 启动逻辑
  scripts/         # GitHub Actions 和本地命令入口
  shared/          # 通用错误类型和命令结果类型
worker/
  app.ts           # Hono HTTP 路由
  env.ts           # Worker 环境变量校验
  github-workflow.ts
  index.ts         # Cloudflare Worker 入口
  scheduled.ts     # cron 触发入口
```

兼容入口仍然保留：

- `src/deploy.ts` 会转发到 `src/scripts/deploy-workspace.ts`。
- `src/keep-alive.ts` 会转发到 `src/scripts/keep-alive-workspace.ts`。
- `worker/keep-alive.ts` 会转发到 `worker/index.ts`。

新代码优先使用 `src/scripts/*` 和 `worker/index.ts`。

## 本地准备

项目使用 Node.js 20 或更高版本。

安装依赖：

```bash
npm install
```

本地运行脚本前，需要准备环境变量：

```bash
export SECRET_ID=你的腾讯云SecretId
export SECRET_KEY=你的腾讯云SecretKey
export ALIST_SPACE_KEY=你的CloudStudio工作区SpaceKey
```

可选环境变量：

```bash
export GITHUB_TOKEN=你的GitHubToken
export GITHUB_REPOSITORY=owner/repo
export GITHUB_REF_NAME=main
```

## 启动 CloudStudio 工作区

手动启动或检查工作区：

```bash
npm run deploy
```

脚本会读取当前账号下的工作区列表，并查找 `ALIST_SPACE_KEY` 对应的工作区：

- 如果工作区已经运行，直接结束。
- 如果工作区已停止，调用 CloudStudio API 启动工作区。
- 如果工作区状态异常，只输出当前状态，不强行处理。

## 执行保活

本地手动执行保活：

```bash
npm run keep-alive
```

兼容入口仍可使用：

```bash
npx tsx src/keep-alive.ts
```

保活脚本会连接到：

```text
{accessToken}@{spaceKey}.{clusterId}.ssh.cloudstudio.work
```

连接成功后，会在工作区内检查端口：

```bash
lsof -i :5244 || ss -tuln | grep :5244 || netstat -tuln | grep :5244
```

如果端口未被占用，会执行：

```bash
cd /workspace/programming-language-demo && nohup pnpm alist >/dev/null 2>&1 &
```

如需修改工作区目录、启动命令或端口，需要调整 `src/keep-alive/alist-service.ts` 中的 `ALIST_PORT`、`ALIST_WORKING_DIRECTORY` 和 `ALIST_START_COMMAND`。

## GitHub Actions 配置

仓库中有三个 workflow：

- `.github/workflows/deploy.yml`：启动 CloudStudio 工作区。
- `.github/workflows/keep-alive.yml`：SSH 到工作区并保活 Alist。
- `.github/workflows/test.yml`：保留的测试入口。

这些 workflow 使用名为 `SecretId` 的 GitHub Environment。需要在该 Environment 中配置 secrets：

```text
ALIST_SPACE_KEY
SECRET_ID
SECRET_KEY
```

如果希望保活失败后自动触发 `deploy.yml`，还需要确保 workflow 中传入了 `GITHUB_TOKEN`。当前 workflow 已经配置：

```yaml
permissions:
  contents: read
  actions: write
```

可以在 GitHub 页面手动触发：

1. 打开仓库的 Actions 页面。
2. 选择 `deploy` 或 `Keep Workspace Alive with SSH`。
3. 点击 `Run workflow`。

## Cloudflare Worker 配置

Worker 入口位于 `worker/index.ts`，部署配置位于 `wrangler.toml`。

登录 Cloudflare：

```bash
npx wrangler login
```

本地调试 Worker：

```bash
npm run worker:dev
```

部署默认环境：

```bash
npm run worker:deploy
```

部署生产环境：

```bash
npm run worker:deploy:prod
```

Cloudflare Worker 需要配置环境变量：

```text
GITHUB_REPO=owner/repo
GITHUB_TOKEN=你的GitHubPersonalAccessToken
WORKFLOW_FILE=keep-alive.yml
GITHUB_BRANCH=main
```

`GITHUB_TOKEN` 权限要求：

- classic token：需要 `repo` 权限。
- fine-grained token：需要目标仓库的 `Actions: Write` 权限。

## Worker 接口

健康检查：

```bash
curl https://你的Worker域名/health
```

手动触发保活 workflow：

```bash
curl -X POST https://你的Worker域名/trigger
```

本地调试时可以使用：

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/trigger
```

## 开启定时触发

当前 `wrangler.toml` 中的 cron 配置是注释状态。要启用自动定时触发，需要取消注释：

```toml
[triggers]
crons = ["*/9 * * * *"]
```

Cloudflare Worker cron 使用 UTC 时间。常用示例：

```toml
crons = ["*/9 * * * *"]   # 每 9 分钟
crons = ["*/5 * * * *"]   # 每 5 分钟
crons = ["0 */2 * * *"]   # 每 2 小时
crons = ["0 1 * * *"]     # 每天 UTC 01:00
```

修改后重新部署 Worker 才会生效。

## 常见问题

### Worker 返回 Workflow not found

检查以下配置：

- `GITHUB_REPO` 必须是 `owner/repo`，不要带 `https://github.com/` 或 `.git`。
- `WORKFLOW_FILE` 必须是文件名，例如 `keep-alive.yml`，不要写 `.github/workflows/keep-alive.yml`。
- workflow 文件必须存在于目标分支。
- workflow 必须包含 `workflow_dispatch:`。
- GitHub Token 必须有触发 Actions 的权限。

### 脚本提示 Missing environment variables

至少缺少下面任意一个环境变量：

```text
SECRET_ID
SECRET_KEY
ALIST_SPACE_KEY
```

本地运行时用 `export` 设置，GitHub Actions 运行时在 `SecretId` Environment 中设置。

### SSH 能连接但 Alist 没启动

检查 `src/keep-alive/alist-service.ts` 中的启动目录和命令是否符合当前工作区：

```bash
cd /workspace/programming-language-demo && nohup pnpm alist >/dev/null 2>&1 &
```

如果项目目录或启动命令不同，需要同步修改。

### Worker 没有自动执行

检查：

- `wrangler.toml` 是否启用了 `[triggers]`。
- Worker 是否重新部署。
- Cloudflare Dashboard 中是否能看到 cron 触发记录。
- Worker 环境变量是否配置在正确环境中。

## 当前限制

- 当前代码只支持一个腾讯云账号和一个目标工作区。
- 端口、工作区目录和启动命令仍写在 `src/keep-alive/alist-service.ts` 中。
- Cloudflare Worker 只负责触发 GitHub workflow，不直接执行 CloudStudio 控制逻辑。
- 多账号、多工作区、切换策略和通知能力仍处于设计阶段。
