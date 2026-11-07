import { and, eq } from "drizzle-orm";
import { env } from "../config.js";
import { decryptToken, encryptToken } from "../crypto/tokens.js";
import { db } from "../db/index.js";
import { accountTokens, accounts, pages } from "../db/schema.js";
import { graphGet } from "../graph/client.js";
import {
  exchangeCodeForToken,
  exchangeLongLived,
  listMeAccounts,
} from "../graph/tokens.js";

export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_read_user_content",
  "email",
  "public_profile",
].join(",");

export function oauthRedirectUri(): string {
  return `${env.APP_URL.replace(/\/$/, "")}/auth/meta/callback`;
}

export function oauthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: oauthRedirectUri(),
    state,
    scope: META_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${env.GRAPH_VERSION}/dialog/oauth?${params}`;
}

export function assertAdminAllowed(email?: string): void {
  const allow = env.ADMIN_EMAILS;
  if (allow.length === 0) return;
  if (!email || !allow.includes(email)) {
    throw new Error("admin_not_allowed");
  }
}

export async function completeOAuth(code: string) {
  const redirectUri = oauthRedirectUri();
  const short = await exchangeCodeForToken(code, redirectUri);
  if (!short.access_token) throw new Error("oauth_no_short_token");

  const long = await exchangeLongLived(short.access_token);
  const userToken = long.access_token ?? short.access_token;

  const me = await graphGet<{
    id: string;
    name?: string;
    email?: string;
  }>("/me", userToken, { fields: "id,name,email" }, "oauth_me");

  assertAdminAllowed(me.email);

  const { tokenEnc, keyVersion } = encryptToken(userToken);
  const expiresAt =
    long.expires_in != null
      ? new Date(Date.now() + long.expires_in * 1000)
      : null;

  const [account] = await db
    .insert(accounts)
    .values({
      metaUserId: me.id,
      name: me.name ?? null,
      email: me.email ?? null,
    })
    .onConflictDoUpdate({
      target: accounts.metaUserId,
      set: {
        name: me.name ?? null,
        email: me.email ?? null,
      },
    })
    .returning();

  await db
    .insert(accountTokens)
    .values({
      accountId: account.id,
      tokenEnc,
      keyVersion,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [accountTokens.accountId, accountTokens.tokenType],
      set: { tokenEnc, keyVersion, expiresAt },
    });

  const listed = await listMeAccounts(userToken);
  const synced: { pageId: string; name: string | null; id: string }[] = [];

  for (const p of listed.data ?? []) {
    if (!p.id || !p.access_token) continue;
    const pageTok = encryptToken(p.access_token);
    const [row] = await db
      .insert(pages)
      .values({
        pageId: p.id,
        accountId: account.id,
        name: p.name ?? null,
        category: p.category ?? null,
        tokenEnc: pageTok.tokenEnc,
        keyVersion: pageTok.keyVersion,
        tokenValid: true,
      })
      .onConflictDoUpdate({
        target: pages.pageId,
        set: {
          accountId: account.id,
          name: p.name ?? null,
          category: p.category ?? null,
          tokenEnc: pageTok.tokenEnc,
          keyVersion: pageTok.keyVersion,
          tokenValid: true,
        },
      })
      .returning({ id: pages.id, pageId: pages.pageId, name: pages.name });

    synced.push({ id: row.id, pageId: row.pageId, name: row.name });
  }

  return {
    accountId: account.id,
    metaUserId: me.id,
    email: me.email,
    name: me.name,
    pages: synced,
  };
}

export async function listPagesForSession(accountId: string) {
  return db
    .select({
      id: pages.id,
      pageId: pages.pageId,
      name: pages.name,
      category: pages.category,
      tokenValid: pages.tokenValid,
      webhookSubscribed: pages.webhookSubscribed,
    })
    .from(pages)
    .where(eq(pages.accountId, accountId));
}

export async function getPageTokenForAccount(
  accountId: string,
  internalPageId: string,
): Promise<{ pageToken: string; facebookPageId: string } | null> {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, internalPageId), eq(pages.accountId, accountId)))
    .limit(1);
  if (!row || !row.tokenValid) return null;
  const pageToken = decryptToken(row.tokenEnc, row.keyVersion);
  return { pageToken, facebookPageId: row.pageId };
}
