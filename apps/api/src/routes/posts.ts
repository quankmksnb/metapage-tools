import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.js";
import { db } from "../db/index.js";
import { scheduledPosts } from "../db/schema.js";
import { GraphApiError } from "../graph/errors.js";
import { schedulePost } from "../graph/pages.js";
import { getPageTokenForAccount } from "../services/meta-oauth.js";

const createPostBody = z.object({
  message: z.string().min(1).max(63206),
  link: z.string().url().optional(),
  runAt: z.string().datetime({ offset: true }),
  mode: z.enum(["native", "worker"]).default("native"),
  kind: z.enum(["text", "link", "photo", "multi_photo"]).default("text"),
});

const NATIVE_MIN_LEAD_MS = 11 * 60 * 1000;

export async function registerPostsRoutes(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/posts",
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
      const list = await db
        .select({
          id: scheduledPosts.id,
          kind: scheduledPosts.kind,
          message: scheduledPosts.message,
          runAt: scheduledPosts.runAt,
          mode: scheduledPosts.mode,
          status: scheduledPosts.status,
          remotePostId: scheduledPosts.remotePostId,
          createdAt: scheduledPosts.createdAt,
        })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.pageId, req.params.pageId))
        .orderBy(desc(scheduledPosts.runAt))
        .limit(50);
      return { posts: list };
    },
  );

  app.post<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/posts",
    async (req, reply) => {
      const { error, session } = requireSession(req);
      if (error || !session) {
        return reply
          .code(401)
          .send({ error: "login_required", login: "/auth/meta" });
      }
      const parsed = createPostBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const body = parsed.data;
      const runAt = new Date(body.runAt);
      if (runAt.getTime() <= Date.now()) {
        return reply.code(400).send({ error: "runAt must be in the future" });
      }

      const tokenRow = await getPageTokenForAccount(
        session.accountId,
        req.params.pageId,
      );
      if (!tokenRow) {
        return reply.code(404).send({ error: "page_not_found" });
      }

      const lead = runAt.getTime() - Date.now();
      if (body.mode === "native" && lead < NATIVE_MIN_LEAD_MS) {
        return reply.code(400).send({
          error: "native_schedule_requires_11_minutes_ahead",
        });
      }

      let remotePostId: string | null = null;
      const status = "queued" as const;

      if (body.mode === "native" && lead >= NATIVE_MIN_LEAD_MS) {
        try {
          const unix = Math.floor(runAt.getTime() / 1000);
          const res = await schedulePost(
            tokenRow.facebookPageId,
            body.message,
            unix,
            tokenRow.pageToken,
          );
          remotePostId = res.id ?? null;
        } catch (err) {
          if (err instanceof GraphApiError) {
            return reply.code(502).send({ error: err.message, code: err.code });
          }
          throw err;
        }
      }

      const [row] = await db
        .insert(scheduledPosts)
        .values({
          pageId: req.params.pageId,
          kind: body.kind,
          message: body.message,
          link: body.link ?? null,
          runAt,
          mode: body.mode,
          status,
          remotePostId,
          createdBy: session.email ?? session.metaUserId,
        })
        .returning();

      return { post: row };
    },
  );

  app.post<{ Params: { pageId: string; postId: string } }>(
    "/api/pages/:pageId/posts/:postId/cancel",
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
      const [job] = await db
        .select()
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.id, req.params.postId),
            eq(scheduledPosts.pageId, req.params.pageId),
          ),
        )
        .limit(1);
      if (!job) {
        return reply.code(404).send({ error: "post_not_found" });
      }
      if (job.status === "canceled" || job.status === "posted") {
        return { post: job };
      }
      const { deletePost } = await import("../graph/pages.js");
      if (job.remotePostId) {
        try {
          await deletePost(job.remotePostId, tokenRow.pageToken);
        } catch (err) {
          if (err instanceof GraphApiError) {
            return reply.code(502).send({ error: err.message });
          }
          throw err;
        }
      }
      const [updated] = await db
        .update(scheduledPosts)
        .set({ status: "canceled" })
        .where(eq(scheduledPosts.id, job.id))
        .returning();
      return { post: updated };
    },
  );
}
