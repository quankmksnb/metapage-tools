import "./load-env.js";
import { buildApp } from "./app.js";
import { env } from "./config.js";
import { closeDb } from "./db/index.js";
import { startBackgroundWorkers } from "./worker/tick.js";

const app = await buildApp();
const stopWorkers = startBackgroundWorkers(app.log);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  stopWorkers();
  await app.close();
  await closeDb();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
