import type { Client } from "ssh2";
import { execSshCommand } from "./ssh-executor";

const ALIST_PORT = 5244;
const ALIST_WORKING_DIRECTORY = "/workspace/programming-language-demo";
const ALIST_START_COMMAND = "pnpm alist";

export async function ensureAlistRunning(connection: Client): Promise<void> {
  console.log(`=== Keep-alive ping at ${new Date().toISOString()} ===`);

  const portCheckCommand = [
    `lsof -i :${ALIST_PORT}`,
    `ss -tuln | grep :${ALIST_PORT}`,
    `netstat -tuln | grep :${ALIST_PORT}`,
  ].join(" || ");

  const portCheck = await execSshCommand(connection, portCheckCommand);

  if (portCheck.stdout.trim().length > 0) {
    console.log(`Port ${ALIST_PORT} is already in use, skipping alist start.`);
    console.log(`Port status output: ${portCheck.stdout.trim()}`);
    return;
  }

  console.log(`Port ${ALIST_PORT} is not in use, starting alist...`);

  // nohup + background execution prevents the SSH session from blocking on
  // the long-running Alist process after the keep-alive command succeeds.
  await execSshCommand(
    connection,
    `cd ${ALIST_WORKING_DIRECTORY} && nohup ${ALIST_START_COMMAND} >/dev/null 2>&1 &`
  );
  console.log("alist process started in background.");
}
