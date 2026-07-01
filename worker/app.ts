import { Hono } from "hono";
import { cors } from "hono/cors";
import type { WorkerEnv } from "./env";
import { triggerWorkflow } from "./github-workflow";

export function createApp() {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  app.use("/*", cors());

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/trigger", async (c) => {
    return triggerWorkflow(c.env);
  });

  app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404);
  });

  app.onError((error, c) => {
    console.error("Error:", error);
    return c.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  });

  return app;
}
