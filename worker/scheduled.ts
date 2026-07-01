import type { WorkerEnv } from "./env";
import { triggerWorkflow } from "./github-workflow";

export async function handleScheduled(
  _event: ScheduledEvent,
  env: WorkerEnv,
  _ctx: ExecutionContext
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Scheduled keep-alive triggered`);
  await triggerWorkflow(env);
}
