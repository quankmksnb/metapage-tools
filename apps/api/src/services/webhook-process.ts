import { and, asc, count, eq, gte } from "drizzle-orm";
import { env } from "../config.js";
import { db } from "../db/index.js";
import { commentRules, replyLog, webhookEvents } from "../db/schema.js";
import {
  createComment,
  hideComment,
  likeComment,
  privateReply,
} from "../graph/comments.js";
import { GraphApiError } from "../graph/errors.js";
import { commentMatchesRule, pickReplyTemplate } from "../rules/match.js";
import { getPageWithTokenByFacebookPageId } from "./page-tokens.js";

type FeedChangeValue = {
  item?: string;
  verb?: string;
  comment_id?: string;
  post_id?: string;
  parent_id?: string;
  message?: string;
  from?: { id?: string; name?: string };
};

export async function processPendingWebhookEvents(limit = 10): Promise<number> {
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.status, "pending"))
    .orderBy(asc(webhookEvents.receivedAt))
    .limit(limit);

  let processed = 0;
  for (const row of rows) {
    const ok = await processOneWebhookEvent(row.id);
    if (ok) processed += 1;
  }
  return processed;
}

async function processOneWebhookEvent(eventRowId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, eventRowId))
    .limit(1);
  if (!row || row.status !== "pending") return false;

  const payload = row.raw as {
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: FeedChangeValue }>;
    }>;
  };

  try {
    const result = await handleFeedPayload(payload);
    await db
      .update(webhookEvents)
      .set({
        status: result.status,
        processedAt: new Date(),
        error: result.error ?? null,
      })
      .where(eq(webhookEvents.id, eventRowId));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "process_failed";
    await db
      .update(webhookEvents)
      .set({
        status: "failed",
        processedAt: new Date(),
        error: message,
      })
      .where(eq(webhookEvents.id, eventRowId));
    return true;
  }
}

async function handleFeedPayload(payload: {
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: FeedChangeValue }>;
  }>;
}): Promise<{ status: "processed" | "skipped"; error?: string }> {
  const entry = payload.entry?.[0];
  const pageFbId = entry?.id;
  const change = entry?.changes?.find((c) => c.field === "feed");
  const value = change?.value;
  if (!pageFbId || !value) {
    return { status: "skipped", error: "no_feed_change" };
  }
  if (value.verb !== "add" || value.item !== "comment") {
    return { status: "skipped", error: "unsupported_verb_or_item" };
  }
  const fromId = value.from?.id;
  if (fromId && fromId === pageFbId) {
    return { status: "skipped", error: "page_self_comment" };
  }
  const commentId = value.comment_id;
  const message = value.message ?? "";
  if (!commentId) {
    return { status: "skipped", error: "no_comment_id" };
  }

  const pageRow = await getPageWithTokenByFacebookPageId(pageFbId);
  if (!pageRow) {
    return { status: "skipped", error: "page_unknown_or_token_invalid" };
  }

  if (!env.AUTO_REPLY_ENABLED) {
    return { status: "skipped", error: "auto_reply_disabled" };
  }

  const [existingReply] = await db
    .select({ id: replyLog.id })
    .from(replyLog)
    .where(eq(replyLog.commentId, commentId))
    .limit(1);
  if (existingReply) {
    return { status: "skipped", error: "already_replied" };
  }

  const rules = await db
    .select()
    .from(commentRules)
    .where(
      and(
        eq(commentRules.pageId, pageRow.internalPageId),
        eq(commentRules.enabled, true),
      ),
    )
    .orderBy(asc(commentRules.priority));

  let matchedRule: (typeof rules)[number] | null = null;
  for (const rule of rules) {
    if (
      commentMatchesRule(
        message,
        rule.matchType,
        rule.pattern,
        rule.caseSensitive,
      )
    ) {
      matchedRule = rule;
      break;
    }
  }
  if (!matchedRule) {
    return { status: "skipped", error: "no_matching_rule" };
  }

  const needsTemplate =
    matchedRule.replyMode === "public" || matchedRule.replyMode === "private";
  const replyText = needsTemplate
    ? pickReplyTemplate(matchedRule.replyTemplates, commentId)
    : `[${matchedRule.replyMode}]`;
  if (needsTemplate && !replyText) {
    return { status: "skipped", error: "empty_template" };
  }

  const commenterId = value.from?.id;
  if (commenterId) {
    if (matchedRule.cooldownSeconds > 0) {
      const since = new Date(Date.now() - matchedRule.cooldownSeconds * 1000);
      const [recent] = await db
        .select({ id: replyLog.id })
        .from(replyLog)
        .where(
          and(
            eq(replyLog.pageId, pageRow.internalPageId),
            eq(replyLog.commenterId, commenterId),
            gte(replyLog.createdAt, since),
          ),
        )
        .limit(1);
      if (recent) {
        return { status: "skipped", error: "cooldown" };
      }
    }

    if (matchedRule.maxPerUserPerDay > 0) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const [daily] = await db
        .select({ total: count() })
        .from(replyLog)
        .where(
          and(
            eq(replyLog.pageId, pageRow.internalPageId),
            eq(replyLog.commenterId, commenterId),
            eq(replyLog.ruleId, matchedRule.id),
            gte(replyLog.createdAt, dayStart),
          ),
        );
      if ((daily?.total ?? 0) >= matchedRule.maxPerUserPerDay) {
        return { status: "skipped", error: "max_per_user_per_day" };
      }
    }
  }

  const logText = replyText ?? `[${matchedRule.replyMode}]`;

  try {
    let remoteCommentId: string | null = null;
    switch (matchedRule.replyMode) {
      case "public": {
        const created = await createComment(
          commentId,
          logText,
          pageRow.pageToken,
        );
        remoteCommentId = created.id;
        break;
      }
      case "private": {
        const created = await privateReply(
          commentId,
          logText,
          pageRow.pageToken,
        );
        remoteCommentId = created.id ?? null;
        break;
      }
      case "hide":
        await hideComment(commentId, pageRow.pageToken);
        break;
      case "like":
        await likeComment(commentId, pageRow.pageToken);
        break;
      default:
        return { status: "skipped", error: "unsupported_reply_mode" };
    }
    await db.insert(replyLog).values({
      pageId: pageRow.internalPageId,
      commentId,
      ruleId: matchedRule.id,
      commenterId: commenterId ?? null,
      replyText: logText,
      remoteCommentId,
    });
    return { status: "processed" };
  } catch (err) {
    if (err instanceof GraphApiError) {
      return { status: "skipped", error: err.message };
    }
    throw err;
  }
}
