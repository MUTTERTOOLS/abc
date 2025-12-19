import process from "node:process";
import { Client } from "ssh2";
import {
  GITHUB_TOKEN,
  REPO_BRANCH,
  REPO_NAME,
  REPO_OWNER,
  SSH_URL,
} from "./env";
import { triggerWorkflow } from "./github";

async function main() {
  // Simplified parsing for user@host format
  const parts = SSH_URL.split("@");
  if (parts.length !== 2) {
    console.error("Error: SSH_URL must be in format user@host");
    process.exit(1);
  }

  const [username, host] = parts;
  const port = 22; // Default port

  console.log(`Connecting to ${username}@${host}:${port}...`);

  try {
    await connectAndRun(host, port, username);
  } catch (error) {
    console.error("SSH Connection/Execution failed:", error);

    // Trigger deploy workflow on failure
    if (GITHUB_TOKEN && REPO_OWNER && REPO_NAME) {
      console.log("Attempting to trigger deploy workflow...");

      triggerWorkflow(
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

    // Exit with code 1 to mark this run as failed
    process.exit(1);
  }
}

function connectAndRun(
  host: string,
  port: number,
  username: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    // 根据用户说明：SSH链接无需密码和身份验证，因此直接连接
    const config: any = {
      host,
      port,
      username,
    };

    conn
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
          const startCmd =
            "cd /workspace/programming-language-demo && pnpm alist";

          await execCommand(conn, startCmd);
          console.log("alist process finished.");
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
