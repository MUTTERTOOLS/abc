/**
 * Cloudflare Worker - Keep Workspace Alive
 * 通过 GitHub API 触发 workflow 来执行 SSH keep-alive
 */

export default {
  async scheduled(event, env, _ctx) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Scheduled keep-alive triggered`);

    // 验证必要的环境变量
    if (!env.GITHUB_REPO) {
      throw new Error('GITHUB_REPO environment variable is required');
    }
    if (!env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    if (!env.WORKFLOW_FILE) {
      throw new Error('WORKFLOW_FILE environment variable is required');
    }

    const repo = env.GITHUB_REPO;
    const workflowFile = env.WORKFLOW_FILE;
    const branch = env.GITHUB_BRANCH || 'main';
    
    console.log(`[${timestamp}] Config: repo=${repo}, workflow=${workflowFile}, branch=${branch}`);

    try {
      // GitHub API 可以使用 workflow 文件名（如 keep-alive.yml）或 workflow ID
      // 如果使用文件名，需要确保格式正确（只是文件名，不包含路径）
      const apiUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;
      console.log(`[${timestamp}] Calling GitHub API: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker-KeepAlive/1.0',
        },
        body: JSON.stringify({
          ref: branch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${timestamp}] GitHub API error: ${response.status}`, errorText);
        
        // 如果是 404，提供更详细的错误信息
        if (response.status === 404) {
          throw new Error(
            `Workflow not found. Please check:\n` +
            `1. GITHUB_REPO is correct (format: owner/repo)\n` +
            `2. WORKFLOW_FILE is correct (filename only, e.g. "keep-alive.yml")\n` +
            `3. The workflow file exists in .github/workflows/ directory\n` +
            `4. The workflow has workflow_dispatch trigger enabled\n` +
            `5. GitHub token has proper permissions\n` +
            `API Response: ${errorText}`
          );
        }
        
        throw new Error(`GitHub API error: ${response.status} ${errorText}`);
      }

      const responseData = await response.json().catch(() => ({}));
      console.log(`[${timestamp}] Successfully triggered workflow`, responseData);
      
      return new Response(JSON.stringify({ 
        success: true, 
        timestamp,
        message: 'Workflow triggered successfully',
        repo,
        workflow: workflowFile,
        branch,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error(`[${timestamp}] Error:`, error);
      return new Response(JSON.stringify({ 
        success: false, 
        timestamp,
        error: error.message,
        config: {
          repo,
          workflow: workflowFile,
          branch,
        },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  // 可选：添加 HTTP 端点用于手动触发
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/trigger' && request.method === 'POST') {
      // 手动触发
      const result = await this.scheduled(null, env, _ctx);
      return result;
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

