import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { pages, webhookEvents } from "../db/schema.js";

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }>;
};

export function webhookEventId(payload: MetaWebhookPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function ingestWebhookPayload(
  payload: MetaWebhookPayload,
): Promise<{ inserted: boolean; id?: string }> {
  const eventId = webhookEventId(payload);
  const facebookPageId = payload.entry?.[0]?.id;
  let internalPageId: string | null = null;
  if (facebookPageId) {
    const [page] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.pageId, facebookPageId))
      .limit(1);
    internalPageId = page?.id ?? null;
  }

  try {
    const [row] = await db
      .insert(webhookEvents)
      .values({
        eventId,
        pageId: internalPageId,
        raw: payload,
        status: "pending",
      })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ id: webhookEvents.id });
    if (!row) return { inserted: false };
    return { inserted: true, id: row.id };
  } catch {
    return { inserted: false };
  }
}
