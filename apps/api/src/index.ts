import "dotenv/config";
import Fastify from "fastify";
import { env } from "./config.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerWebhookRoutes } from "./routes/webhook.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "metapage-tools-api",
  graphApiVersion: "v25.0",
}));

await registerMetaRoutes(app);
await registerWebhookRoutes(app);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
