import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./config.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerWebhookRoutes } from "./routes/webhook.js";

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });

  app.get("/health", async () => ({
    ok: true,
    service: "metapage-tools-api",
    graphApiVersion: env.GRAPH_VERSION,
  }));

  await registerMetaRoutes(app);
  await registerWebhookRoutes(app);

  return app;
}
