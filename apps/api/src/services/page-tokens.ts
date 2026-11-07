import { eq } from "drizzle-orm";
import { decryptToken } from "../crypto/tokens.js";
import { db } from "../db/index.js";
import { pages } from "../db/schema.js";

export async function getPageWithTokenByFacebookPageId(facebookPageId: string) {
  const [row] = await db
    .select()
    .from(pages)
    .where(eq(pages.pageId, facebookPageId))
    .limit(1);
  if (!row || !row.tokenValid) return null;
  const pageToken = decryptToken(row.tokenEnc, row.keyVersion);
  return {
    internalPageId: row.id,
    facebookPageId: row.pageId,
    pageToken,
    webhookSubscribed: row.webhookSubscribed,
  };
}
