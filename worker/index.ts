import { createApp } from "./app";
import type { WorkerEnv } from "./env";
import { handleScheduled } from "./scheduled";

const app = createApp();

export default {
  scheduled: handleScheduled,

  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
