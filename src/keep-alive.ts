import process from "node:process";
import { Client, ConnectConfig } from "ssh2";
import { getAccessToken, getWorkspaceStatus } from "./api";
import {
  ALIST_SPACE_KEY,
  GITHUB_TOKEN,
  REPO_BRANCH,
  REPO_NAME,
  REPO_OWNER,
} from "./env";
import { triggerWorkflow } from "./github";

async function main() {
  const accessToken = await getAccessToken(ALIST_SPACE_KEY);
  const workspace = (await getWorkspaceStatus()).find(
    (item) => item.spaceKey === ALIST_SPACE_KEY
  );

  if (!workspace) {
    console.error("No workspace found");
    process.exit(1);
  }

  const clusterId = workspace.clusterId;
  const username = accessToken;
  const host = `${ALIST_SPACE_KEY}.${clusterId}.ssh.cloudstudio.work`;
  const port = 22; // Default port

  console.log(`Connecting to ${username}@${host}:${port}...`);
  try {
    await connectAndRun(username, host);
  } catch (error) {
    console.error("SSH Connection/Execution failed:", error);

    // Trigger deploy workflow on failure
    if (GITHUB_TOKEN && REPO_OWNER && REPO_NAME) {
      console.log("Attempting to trigger deploy workflow...");

      await triggerWorkflow(
        REPO_OWNER,
        REPO_NAME,
        "deploy.yml",
        REPO_BRANCH,
        GITHUB_TOKEN
      );
      console.log("Deploy dispatch request sent.");
    } else {
      console.error(
        "Missing GITHUB_TOKEN or repository info, cannot trigger deploy workflow."
      );
    }
  }
}

function connectAndRun(username: string, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    // 根据用户说明：SSH链接无需密码和身份验证，因此直接连接
    const config: ConnectConfig = {
      host,
      username,
      tryKeyboard: true, // 尝试键盘交互认证（即使为空）
      readyTimeout: 20000,
    };

    conn
      .on(
        "keyboard-interactive",
        (name, instructions, instructionsLang, prompts, finish) => {
          // 对于无需密码的场景，直接返回空回答
          finish(prompts.map(() => ""));
        }
      )
      .on("ready", async () => {
        console.log("SSH Connection ready.");
        console.log(`=== Keep-alive ping at ${new Date().toISOString()} ===`);

        try {
          // Step 1: Check port 5244
          const checkPortCmd =
            "lsof -i :5244 || ss -tuln | grep :5244 || netstat -tuln | grep :5244";
          const { stdout: portCheckOut } = await execCommand(
            conn,
            checkPortCmd
          ).catch(() => ({ stdout: "" }));

          if (portCheckOut && portCheckOut.trim().length > 0) {
            console.log("Port 5244 is already in use, skipping alist start.");
            console.log(`Port status output: ${portCheckOut.trim()}`);
            conn.end();
            resolve();
            return;
          }

          console.log("Port 5244 is not in use, starting alist...");

          // Step 2: Start alist
          // 使用 nohup 和 & 在后台运行，并将输出重定向到 /dev/null 防止阻塞
          const startCmd =
            "cd /workspace/programming-language-demo && nohup pnpm alist >/dev/null 2>&1 &";

          await execCommand(conn, startCmd);
          console.log("alist process started in background.");
          conn.end();
          resolve();
        } catch (err) {
          conn.end();
          reject(err);
        }
      })
      .on("error", (err) => {
        // SSH Connection Error
        reject(err);
      })
      .connect(config);
  });
}

function execCommand(
  conn: Client,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      stream
        .on("close", (code: number, _signal: any) => {
          resolve({ stdout, stderr, code });
        })
        .on("data", (data: any) => {
          stdout += data.toString();
          process.stdout.write(data);
        });

      stream.stderr.on("data", (data: any) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    });
  });
}

main().catch((err) => {
  console.error("Main Error:", err);
  process.exit(1);
});
