# Cloudflare Worker - Keep Alive

使用 Cloudflare Workers 实现更精准的周期任务，替代 GitHub Actions 的 cron。

## 功能

- 通过 Cloudflare Workers 的 cron trigger 定期触发
- 调用 GitHub API 触发 workflow_dispatch 来执行 SSH keep-alive
- 比 GitHub Actions 的 cron 更精准、更可靠

## 配置步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 配置环境变量

在 Cloudflare Dashboard 中设置以下环境变量：

- `GITHUB_REPO`: 仓库名称，格式为 `owner/repo`（例如：`username/abc`）
- `GITHUB_TOKEN`: GitHub Personal Access Token
  - 创建 Token：GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  - 需要 `repo` 权限（用于触发 workflow）
  - 或者使用 Fine-grained token，需要 `Actions: Write` 权限
- `WORKFLOW_FILE`: workflow 文件名（例如：`keep-alive.yml`）
- `GITHUB_BRANCH`: 分支名称（可选，默认为 `main`）

### 4. 部署 Worker

```bash
# 开发环境
pnpm run worker:dev

# 部署到生产环境
pnpm run worker:deploy

# 或使用生产环境配置
pnpm run worker:deploy:prod
```

## Cron 配置

在 `wrangler.toml` 中配置 cron：

```toml
[triggers]
crons = ["*/9 * * * *"]  # 每9分钟执行一次
```

Cron 格式：`分钟 小时 日 月 星期`

示例：
- `*/9 * * * *` - 每9分钟
- `*/5 * * * *` - 每5分钟
- `0 */2 * * *` - 每2小时
- `0 9 * * *` - 每天9点

## 优势

1. **更精准**：Cloudflare Workers 的 cron 比 GitHub Actions 更准时
2. **更可靠**：不受 GitHub 负载影响
3. **免费额度**：Cloudflare Workers 免费计划包含 100,000 次请求/天
4. **低延迟**：全球边缘网络，响应更快

## 手动触发

Worker 还提供了 HTTP 端点用于手动触发：

```bash
# 健康检查
curl https://your-worker.workers.dev/health

# 手动触发（需要 POST 请求）
curl -X POST https://your-worker.workers.dev/trigger
```

## 注意事项

1. 确保 GitHub Token 有足够的权限
2. 确保 workflow 文件在指定的分支上
3. Cloudflare Workers 免费计划有请求限制，但足够 keep-alive 使用

