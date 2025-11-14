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
      // 根据 GitHub API 文档，可以直接使用文件名触发 workflow
      // API 格式: /repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches
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
        
        // 如果是 404，尝试获取 workflow ID 再试一次
        if (response.status === 404 && isNaN(workflowFile)) {
          console.log(`[${timestamp}] Workflow not found by filename, trying to get workflow ID...`);
          
          try {
            // 获取 workflows 列表
            const workflowsUrl = `https://api.github.com/repos/${repo}/actions/workflows`;
            const workflowsResponse = await fetch(workflowsUrl, {
              headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Cloudflare-Worker-KeepAlive/1.0',
              },
            });

            if (workflowsResponse.ok) {
              const workflowsData = await workflowsResponse.json();
              const workflow = workflowsData.workflows?.find(
                w => w.path === `.github/workflows/${workflowFile}` || w.name === workflowFile
              );
              
              if (workflow) {
                const workflowId = workflow.id.toString();
                console.log(`[${timestamp}] Found workflow ID: ${workflowId}, retrying with ID...`);
                
                // 使用 workflow ID 重试
                const retryUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`;
                const retryResponse = await fetch(retryUrl, {
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

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json().catch(() => ({}));
                  console.log(`[${timestamp}] Successfully triggered workflow using ID`, retryData);
                  
                  return new Response(JSON.stringify({ 
                    success: true, 
                    timestamp,
                    message: 'Workflow triggered successfully (using workflow ID)',
                    repo,
                    workflowFile,
                    workflowId,
                    branch,
                  }), {
                    headers: { 'Content-Type': 'application/json' },
                  });
                } else {
                  const retryErrorText = await retryResponse.text();
                  throw new Error(`Retry with workflow ID also failed: ${retryResponse.status} ${retryErrorText}`);
                }
              }
            }
          } catch (retryError) {
            console.error(`[${timestamp}] Failed to retry with workflow ID:`, retryError);
          }
        }
        
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
        workflowFile,
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
          workflowFile,
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

