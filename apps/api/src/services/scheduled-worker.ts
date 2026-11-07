import { and, eq, lte, sql } from "drizzle-orm";
import { env } from "../config.js";
import { decryptToken } from "../crypto/tokens.js";
import { db } from "../db/index.js";
import { pages, scheduledPosts } from "../db/schema.js";
import { createFeedPost } from "../graph/pages.js";

export async function processDueScheduledPosts(limit = 5): Promise<number> {
  if (!env.WORKER_ENABLED) return 0;

  const due = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "queued"),
        eq(scheduledPosts.mode, "worker"),
        lte(scheduledPosts.runAt, new Date()),
      ),
    )
    .limit(limit);

  let done = 0;
  for (const job of due) {
    if (job.remotePostId) {
      await db
        .update(scheduledPosts)
        .set({ status: "posted" })
        .where(eq(scheduledPosts.id, job.id));
      done += 1;
      continue;
    }

    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.id, job.pageId))
      .limit(1);
    if (!page?.tokenValid) {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          lastError: "page_token_missing",
          attempts: sql`${scheduledPosts.attempts} + 1`,
        })
        .where(eq(scheduledPosts.id, job.id));
      continue;
    }

    const pageToken = decryptToken(page.tokenEnc, page.keyVersion);
    try {
      const res = await createFeedPost(
        page.pageId,
        {
          message: job.message ?? undefined,
          link: job.link ?? undefined,
          published: true,
        },
        pageToken,
      );
      await db
        .update(scheduledPosts)
        .set({
          status: "posted",
          remotePostId: res.id ?? null,
        })
        .where(eq(scheduledPosts.id, job.id));
      done += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "post_failed";
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          lastError: message,
          attempts: sql`${scheduledPosts.attempts} + 1`,
        })
        .where(eq(scheduledPosts.id, job.id));
    }
  }
  return done;
}
