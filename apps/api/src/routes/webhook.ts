import type { FastifyInstance } from "fastify";
import { env } from "../config.js";

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.get("/webhooks/meta", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];
    if (mode === "subscribe" && token === env.META_VERIFY_TOKEN && challenge) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send("Forbidden");
  });

  app.post("/webhooks/meta", async (req, reply) => {
    // TODO: verify X-Hub-Signature-256, parse feed, enqueue auto-reply
    app.log.info({ body: req.body }, "meta webhook received");
    return reply.code(200).send("EVENT_RECEIVED");
  });
}
