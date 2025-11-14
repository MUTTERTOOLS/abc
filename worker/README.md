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

**必需的环境变量：**

- `GITHUB_REPO`: 仓库名称，格式为 `owner/repo`（例如：`username/abc`）
  - ⚠️ 注意：不要包含 `.git` 后缀
  - 示例：`myusername/my-repo`

- `GITHUB_TOKEN`: GitHub Personal Access Token
  - 创建 Token：GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  - 需要 `repo` 权限（用于触发 workflow）
  - 或者使用 Fine-grained token，需要 `Actions: Write` 权限

- `WORKFLOW_FILE`: workflow 文件名
  - ⚠️ **重要**：只填写文件名，不包含路径
  - ✅ 正确：`keep-alive.yml`
  - ❌ 错误：`.github/workflows/keep-alive.yml` 或 `keep-alive`
  - 文件名必须与 `.github/workflows/` 目录中的文件完全匹配（包括扩展名）

**可选的环境变量：**

- `GITHUB_BRANCH`: 分支名称（可选，默认为 `main`）
  - 确保 workflow 文件存在于该分支上

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

## 故障排查

### 404 错误：Workflow not found

如果遇到 404 错误，请检查：

1. **GITHUB_REPO 格式**：
   - ✅ 正确：`username/repo-name`
   - ❌ 错误：`https://github.com/username/repo-name` 或 `username/repo-name.git`

2. **WORKFLOW_FILE 格式**：
   - ✅ 正确：`keep-alive.yml`（只是文件名）
   - ❌ 错误：`.github/workflows/keep-alive.yml` 或 `keep-alive`

3. **Workflow 文件存在**：
   - 确保 `.github/workflows/keep-alive.yml` 文件存在于仓库中
   - 确保文件在指定的分支上（默认是 `main`）

4. **Workflow 配置**：
   - 确保 workflow 文件中有 `workflow_dispatch:` 触发器
   - 检查 workflow 文件语法是否正确

5. **GitHub Token 权限**：
   - 确保 Token 有 `repo` 权限（对于 classic token）
   - 或确保 Fine-grained token 有 `Actions: Write` 权限

### 查看详细日志

部署后，在 Cloudflare Dashboard 的 Logs 中查看详细错误信息，包括：
- 使用的配置（repo、workflow、branch）
- GitHub API 的完整响应

## 注意事项

1. 确保 GitHub Token 有足够的权限
2. 确保 workflow 文件在指定的分支上
3. Cloudflare Workers 免费计划有请求限制，但足够 keep-alive 使用
4. 环境变量配置后需要重新部署 Worker 才能生效

