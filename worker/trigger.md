# 手动触发 Scheduled 函数

## 方法 1: 使用 HTTP POST 请求（推荐）

部署后，通过 HTTP POST 请求到 `/trigger` 端点：

```bash
# 替换为你的 Worker URL
curl -X POST https://keep-alive-worker.your-subdomain.workers.dev/trigger
```

或者使用浏览器访问（需要支持 POST 请求的工具，如 Postman）：
- URL: `https://your-worker.workers.dev/trigger`
- Method: POST

## 方法 2: 使用 Wrangler CLI 测试

在本地开发时，可以使用 Wrangler 的测试功能：

```bash
# 测试 scheduled 函数
pnpm run worker:trigger

# 或者直接使用
npx wrangler dev --test-scheduled
```

## 方法 3: 在 Cloudflare Dashboard 中触发

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages → 你的 Worker
3. 点击 "Triggers" 标签
4. 找到 Cron Triggers 部分
5. 点击 "Trigger" 按钮手动触发

## 方法 4: 使用 Wrangler Tail 监控并手动触发

```bash
# 监控日志
npx wrangler tail

# 在另一个终端触发
curl -X POST https://your-worker.workers.dev/trigger
```

## 健康检查

检查 Worker 是否正常运行：

```bash
curl https://your-worker.workers.dev/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "2025-11-14T06:45:00.000Z"
}
```

