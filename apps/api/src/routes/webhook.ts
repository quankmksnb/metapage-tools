import { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config.js";
import {
  type MetaWebhookPayload,
  ingestWebhookPayload,
} from "../services/webhook-ingest.js";
import { verifyMetaWebhookSignature } from "../webhook/signature.js";

type RequestWithRawBody = FastifyRequest & { rawBody?: Buffer };

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

  app.post("/webhooks/meta", {
    config: { rawBody: true },
    preParsing: async (request, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks);
      (request as RequestWithRawBody).rawBody = raw;
      return Readable.from(raw);
    },
    handler: async (req, reply) => {
      const raw = (req as RequestWithRawBody).rawBody;
      if (!raw?.length) {
        return reply.code(400).send("missing body");
      }
      const signature = req.headers["x-hub-signature-256"];
      const signatureHeader = Array.isArray(signature)
        ? signature[0]
        : signature;
      if (
        !verifyMetaWebhookSignature(raw, signatureHeader, env.META_APP_SECRET)
      ) {
        return reply.code(401).send("invalid signature");
      }

      let payload: MetaWebhookPayload;
      try {
        payload = JSON.parse(raw.toString("utf8")) as MetaWebhookPayload;
      } catch {
        return reply.code(400).send("invalid json");
      }

      await ingestWebhookPayload(payload);
      return reply.code(200).send("EVENT_RECEIVED");
    },
  });
}
