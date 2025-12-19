/**
 * Cloudflare Worker - Keep Workspace Alive
 * 通过 GitHub API 触发 workflow 来执行 SSH keep-alive
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

// Cloudflare Workers 环境变量类型定义
interface Env {
  GITHUB_REPO: string;
  GITHUB_TOKEN: string;
  WORKFLOW_FILE: string;
  GITHUB_BRANCH?: string;

  KEEP_ALIVE_KV: KVNamespace;
}

// GitHub API 响应类型
interface SuccessResponse {
  success: true;
  timestamp: string;
  message: string;
  repo: string;
  workflowFile: string;
  branch?: string;
  workflowId?: string;
}

interface ErrorResponse {
  success: false;
  timestamp: string;
  error: string;
  config: {
    repo: string;
    workflowFile: string;
    branch?: string;
  };
}

import { Octokit } from "@octokit/rest";

// 通用的触发 workflow 函数
async function triggerWorkflowByName(
  repo: string,
  workflowFile: string,
  branch: string,
  token: string,
  timestamp: string
): Promise<{ success: boolean; error?: string; workflowId?: string }> {
  try {
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
    }

    const octokit = new Octokit({ auth: token });
    console.log(`[${timestamp}] Calling GitHub API via Octokit`);

    await octokit.actions.createWorkflowDispatch({
      owner,
      repo: repoName,
      workflow_id: workflowFile,
      ref: branch,
    });

    console.log(
      `[${timestamp}] Successfully triggered workflow ${workflowFile}`
    );
    return { success: true };
  } catch (error) {
    const err = error as any;
    console.error(`[${timestamp}] Error triggering ${workflowFile}:`, err);

    // 如果是 404，提供更详细的错误信息
    if (err.status === 404) {
      return {
        success: false,
        error:
          `Workflow not found. Please check:\n` +
          `1. GITHUB_REPO is correct (format: owner/repo)\n` +
          `2. WORKFLOW_FILE is correct (filename only, e.g. "${workflowFile}")\n` +
          `3. The workflow file exists in .github/workflows/ directory\n` +
          `4. The workflow has workflow_dispatch trigger enabled\n` +
          `5. GitHub token has proper permissions\n` +
          `API Message: ${err.message}`,
      };
    }

    return { success: false, error: err.message || "Unknown error" };
  }
}

// 触发 workflow 的核心函数
async function triggerWorkflow(env: Env): Promise<Response> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Triggering keep-alive workflow`);

  // 验证必要的环境变量
  if (!env.GITHUB_REPO) {
    throw new Error("GITHUB_REPO environment variable is required");
  }
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  if (!env.WORKFLOW_FILE) {
    throw new Error("WORKFLOW_FILE environment variable is required");
  }

  const repo = env.GITHUB_REPO;
  const workflowFile = env.WORKFLOW_FILE;
  const branch = env.GITHUB_BRANCH || "main";

  console.log(
    `[${timestamp}] Config: repo=${repo}, workflow=${workflowFile}, branch=${branch}`
  );

  try {
    // 触发 keep-alive workflow
    const result = await triggerWorkflowByName(
      repo,
      workflowFile,
      branch,
      env.GITHUB_TOKEN,
      timestamp
    );

    if (result.success) {
      const successResponse: SuccessResponse = {
        success: true,
        timestamp,
        message: "Workflow triggered successfully",
        repo,
        workflowFile,
        branch,
        workflowId: result.workflowId,
      };
      return Response.json(successResponse);
    }

    // Workflow 触发失败
    const errorResponse: ErrorResponse = {
      success: false,
      timestamp,
      error: result.error || "Failed to trigger workflow",
      config: {
        repo,
        workflowFile,
        branch,
      },
    };
    return Response.json(errorResponse, { status: 500 });
  } catch (error) {
    const err = error as Error;
    console.error(`[${timestamp}] Error:`, err);

    const errorResponse: ErrorResponse = {
      success: false,
      timestamp,
      error: err.message,
      config: {
        repo,
        workflowFile,
        branch,
      },
    };

    return Response.json(errorResponse, { status: 500 });
  }
}

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env }>();

// 添加 CORS 支持（可选）
app.use("/*", cors());

// 健康检查端点
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// 手动触发 workflow
app.post("/trigger", async (c) => {
  const env = c.env;
  const result = await triggerWorkflow(env);
  return result;
});

// 404 处理
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// Cloudflare Workers 导出
export default {
  // Scheduled 触发器（cron）
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Scheduled keep-alive triggered`);
    await triggerWorkflow(env);
  },

  // HTTP 请求处理
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};
