import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireSession } from "../auth/guard.js";
import { db } from "../db/index.js";
import { pages } from "../db/schema.js";
import { graphGet, graphPost } from "../graph/client.js";
import { createComment } from "../graph/comments.js";
import { GraphApiError } from "../graph/errors.js";
import {
  getPageTokenForAccount,
  listPagesForSession,
} from "../services/meta-oauth.js";

export async function registerPagesRoutes(app: FastifyInstance) {
  app.get("/api/pages", async (req, reply) => {
    const { error, session } = requireSession(req);
    if (error || !session) {
      return reply
        .code(401)
        .send({ error: "login_required", login: "/auth/meta" });
    }
    const list = await listPagesForSession(session.accountId);
    return { pages: list };
  });

  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/published-posts",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }
      try {
        const feed = await graphGet<{
          data?: Array<{
            id: string;
            message?: string;
            permalink_url?: string;
            created_time?: string;
          }>;
        }>(
          `/${tokenRow.facebookPageId}/published_posts`,
          tokenRow.pageToken,
          {
            fields: "id,message,permalink_url,created_time",
            limit: "25",
          },
          "published_posts_list",
        );
        return { posts: feed.data ?? [] };
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
    },
  );

  app.post<{
    Params: { pageId: string };
    Body: { objectId: string; message: string };
  }>("/api/pages/:pageId/comments", async (req, reply) => {
    const { error, session } = requireSession(req);
    if (error || !session) {
      return reply
        .code(401)
        .send({ error: "login_required", login: "/auth/meta" });
    }
    const { objectId, message } = req.body ?? {};
    if (!objectId || !message) {
      return reply.code(400).send({ error: "objectId and message required" });
    }
    const tokenRow = await getPageTokenForAccount(
      session.accountId,
      req.params.pageId,
    );
    if (!tokenRow) {
      return reply.code(404).send({ error: "page_not_found" });
    }
    try {
      const result = await createComment(objectId, message, tokenRow.pageToken);
      return result;
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

  app.post<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/subscribe",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }
      try {
        await graphPost(
          `/${tokenRow.facebookPageId}/subscribed_apps`,
          tokenRow.pageToken,
          { subscribed_fields: "feed" },
          undefined,
          "page_subscribe",
        );
      } catch (err) {
        if (err instanceof GraphApiError) {
          const status =
            err.category === "TOKEN_INVALID"
              ? 401
              : err.category === "PERMISSION"
                ? 403
                : 502;
          return reply.code(status).send({
            error: err.message,
            category: err.category,
            code: err.code,
            hint:
              err.category === "PERMISSION"
                ? "Thêm pages_manage_metadata trong META_OAUTH_SCOPES + trên Meta use case Page, rồi đăng nhập lại /auth/meta"
                : undefined,
          });
        }
        throw err;
      }
      await db
        .update(pages)
        .set({ webhookSubscribed: true })
        .where(eq(pages.id, req.params.pageId));
      return { ok: true, subscribed_fields: ["feed"] };
    },
  );

  app.delete<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/subscribe",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }
      const { graphDelete } = await import("../graph/client.js");
      await graphDelete(
        `/${tokenRow.facebookPageId}/subscribed_apps`,
        tokenRow.pageToken,
        undefined,
        "page_unsubscribe",
      );
      await db
        .update(pages)
        .set({ webhookSubscribed: false })
        .where(eq(pages.id, req.params.pageId));
      return { ok: true };
    },
  );
}
