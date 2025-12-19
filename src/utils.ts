// @ts-check
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ExecResult {
  ok: boolean;
  code: number;
  stderr: string;
  stdout: string;
}

export const require = createRequire(import.meta.url);
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);
export const cwd = resolve(__dirname, "..");

export async function exec(
  command: string,
  args: ReadonlyArray<string>,
  options: object
) {
  return new Promise<ExecResult>((resolve, reject) => {
    const _process = spawn(command, args, {
      stdio: [
        "ignore", // stdin
        "pipe", // stdout
        "pipe", // stderr
      ],
      ...options,
      shell: process.platform === "win32",
    });

    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];

    _process.stderr?.on("data", (chunk: Buffer) => {
      console.log(chunk.toString());
      stderrChunks.push(chunk);
    });

    _process.stdout?.on("data", (chunk: Buffer) => {
      console.log(chunk.toString());
      stdoutChunks.push(chunk);
    });

    _process.on("error", (error) => {
      reject(error);
    });

    _process.on("exit", (code) => {
      const ok = code === 0;
      const stderr = Buffer.concat(stderrChunks).toString().trim();
      const stdout = Buffer.concat(stdoutChunks).toString().trim();

      if (ok) {
        const result = { ok, code, stderr, stdout };
        resolve(result);
      } else {
        const details = [
          `Failed to execute command: ${command} ${args.join(" ")}`,
          stdout ? `stdout:\n${stdout}` : "",
          stderr ? `stderr:\n${stderr}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        reject(new Error(details));
      }
    });
  });
}

export function execCmd(command: string, options: object) {
  // 使用 shell 执行整条命令，保证引号与空格不被拆分
  if (process.platform === "win32") {
    return exec("cmd", ["/c", command], options);
  }
  return exec("sh", ["-lc", command], options);
}

// console.log(await exec('ls', ['-l'], {}));
