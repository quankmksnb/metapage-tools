import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./config.js";
import { pingDb } from "./db/index.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerWebhookRoutes } from "./routes/webhook.js";

const loggerRedact = {
  paths: [
    "req.headers.authorization",
    "req.body.pageAccessToken",
    "*.access_token",
    "*.token_enc",
    "*.pageAccessToken",
  ],
  censor: "[Redacted]",
};

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const useLogger = options.logger ?? true;
  const app = Fastify({
    logger: useLogger ? { level: "info", redact: loggerRedact } : false,
  });

  app.get("/health", async () => ({
    ok: true,
    service: "metapage-tools-api",
    graphApiVersion: env.GRAPH_VERSION,
  }));

  app.get("/ready", async (_req, reply) => {
    try {
      await pingDb();
      return { ok: true, database: "up" };
    } catch (err) {
      app.log.error({ err }, "database not ready");
      return reply.code(503).send({ ok: false, database: "down" });
    }
  });

  await registerMetaRoutes(app);
  await registerWebhookRoutes(app);

  return app;
}
