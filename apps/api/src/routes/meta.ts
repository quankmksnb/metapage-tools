import type { FastifyInstance } from "fastify";
import { env } from "../config.js";
import { createComment } from "../graph/comments.js";
import { GraphApiError } from "../graph/errors.js";

/**
 * MVP: endpoint thử comment (POST body) — production sẽ đi qua DB + queue.
 * Không nhận token qua query string ở bản sau; dùng session đã OAuth.
 */
export async function registerMetaRoutes(app: FastifyInstance) {
  app.get("/auth/meta", async () => ({
    configured: Boolean(env.META_APP_ID && env.META_APP_SECRET),
    next: "Implement Facebook Login → exchange → /me/accounts → store Page token",
    docs: "docs/META_SETUP.md",
  }));

  app.post<{
    Body: { objectId: string; message: string; pageAccessToken: string };
  }>("/api/comments", async (req, reply) => {
    const { objectId, message, pageAccessToken } = req.body ?? {};
    if (!objectId || !message || !pageAccessToken) {
      return reply
        .code(400)
        .send({ error: "objectId, message, pageAccessToken required" });
    }
    try {
      return await createComment(objectId, message, pageAccessToken);
    } catch (err) {
      if (err instanceof GraphApiError) {
        const status = err.category === "TOKEN_INVALID" ? 401 : 502;
        return reply.code(status).send({
          error: err.message,
          category: err.category,
          code: err.code,
        });
      }
      throw err;
    }
  });
}
