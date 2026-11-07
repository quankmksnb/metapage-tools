import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireSession } from "../auth/guard.js";
import { db } from "../db/index.js";
import { replyLog, webhookEvents } from "../db/schema.js";
import { getPageTokenForAccount } from "../services/meta-oauth.js";

export async function registerInboxRoutes(app: FastifyInstance) {
  app.get<{ Params: { pageId: string } }>(
    "/api/pages/:pageId/inbox",
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

      const replies = await db
        .select({
          id: replyLog.id,
          commentId: replyLog.commentId,
          commenterId: replyLog.commenterId,
          replyText: replyLog.replyText,
          remoteCommentId: replyLog.remoteCommentId,
          ruleId: replyLog.ruleId,
          createdAt: replyLog.createdAt,
        })
        .from(replyLog)
        .where(eq(replyLog.pageId, req.params.pageId))
        .orderBy(desc(replyLog.createdAt))
        .limit(50);

      const events = await db
        .select({
          id: webhookEvents.id,
          eventId: webhookEvents.eventId,
          status: webhookEvents.status,
          error: webhookEvents.error,
          receivedAt: webhookEvents.receivedAt,
          processedAt: webhookEvents.processedAt,
        })
        .from(webhookEvents)
        .where(eq(webhookEvents.pageId, req.params.pageId))
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(30);

      return { replies, events };
    },
  );
}
