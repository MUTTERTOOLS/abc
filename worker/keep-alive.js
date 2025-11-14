/**
 * Cloudflare Worker - Keep Workspace Alive
 * 通过 GitHub API 触发 workflow 来执行 SSH keep-alive
 */

export default {
  async scheduled(event, env, _ctx) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Scheduled keep-alive triggered`);

    try {
      // 通过 GitHub API 触发 workflow_dispatch
      const response = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: env.GITHUB_BRANCH || 'main',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${errorText}`);
      }

      console.log(`[${timestamp}] Successfully triggered workflow`);
      return new Response(JSON.stringify({ 
        success: true, 
        timestamp,
        message: 'Workflow triggered successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error(`[${timestamp}] Error:`, error);
      return new Response(JSON.stringify({ 
        success: false, 
        timestamp,
        error: error.message 
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

