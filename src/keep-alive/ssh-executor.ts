import process from "node:process";
import { Client, type ConnectConfig } from "ssh2";
import type { CommandResult } from "../shared/command-result";
import type { SshTarget } from "./ssh-target";

export function withSshConnection(
  target: SshTarget,
  run: (connection: Client) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const connection = new Client();
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const config: ConnectConfig = {
      host: target.host,
      port: target.port,
      username: target.username,
      // CloudStudio grants access through the token username in this setup.
      // Empty keyboard-interactive answers preserve the old no-password flow.
      tryKeyboard: true,
      readyTimeout: 20000,
    };

    connection
      .on("keyboard-interactive", (_name, _instructions, _lang, prompts, done) => {
        done(prompts.map(() => ""));
      })
      .on("ready", async () => {
        console.log("SSH Connection ready.");
        try {
          await run(connection);
          connection.end();
          finish();
        } catch (error) {
          connection.end();
          finish(error);
        }
      })
      .on("error", (error) => {
        finish(error);
      })
      .connect(config);
  });
}

export function execSshCommand(
  connection: Client,
  command: string
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";

      stream
        .on("close", (code: number | null) => {
          resolve({ stdout, stderr, code });
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString();
          process.stdout.write(data);
        });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    });
  });
}
