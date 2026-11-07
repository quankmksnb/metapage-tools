import { env } from "../config.js";
import { processDueScheduledPosts } from "../services/scheduled-worker.js";
import { processPendingWebhookEvents } from "../services/webhook-process.js";

type Log = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export function startBackgroundWorkers(log: Log): () => void {
  if (!env.WORKER_ENABLED && !env.AUTO_REPLY_ENABLED) {
    return () => {};
  }

  const tick = async () => {
    try {
      let webhooks = 0;
      let posts = 0;
      if (env.AUTO_REPLY_ENABLED) {
        webhooks = await processPendingWebhookEvents(20);
      }
      if (env.WORKER_ENABLED) {
        posts = await processDueScheduledPosts(10);
      }
      if (webhooks > 0 || posts > 0) {
        log.info({ webhooks, posts }, "worker tick");
      }
    } catch (err) {
      log.error({ err }, "worker tick failed");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 30_000);
  return () => clearInterval(timer);
}
