import "../src/load-env.js";
import { ilike } from "drizzle-orm";
import { decryptToken } from "../src/crypto/tokens.js";
import { closeDb, db } from "../src/db/index.js";
import { pages } from "../src/db/schema.js";
import { graphGet } from "../src/graph/client.js";
import { createComment } from "../src/graph/comments.js";

const arg0 = process.argv[2];
const LIST_ONLY = arg0 === "--list";
const FBFID = LIST_ONLY ? "" : (arg0 ?? "331788966201246");
const MSG =
  process.argv[3] ?? "PageDesk test — comment từ Graph API (có thể xóa sau)";

async function resolveObjectId(
  fbid: string,
  pageId: string,
  token: string,
): Promise<string> {
  if (fbid.includes("_")) return fbid;

  const feed = await graphGet<{
    data?: Array<{ id: string; permalink_url?: string }>;
  }>(
    `/${pageId}/published_posts`,
    token,
    {
      fields: "id,permalink_url,created_time",
      limit: "50",
    },
    "feed_lookup",
  );
  const hit = feed.data?.find(
    (p) => p.id.includes(fbid) || (p.permalink_url?.includes(fbid) ?? false),
  );
  if (hit) return hit.id;

  const composite = `${pageId}_${fbid}`;
  try {
    await graphGet(`/${composite}`, token, { fields: "id" }, "composite_check");
    return composite;
  } catch {
    /* try other ids */
  }

  const photos = await graphGet<{ data?: Array<{ id: string }> }>(
    `/${pageId}/photos`,
    token,
    { fields: "id,created_time", limit: "50" },
    "photos_lookup",
  );
  const photo = photos.data?.find((p) => p.id === fbid);
  if (photo) return photo.id;

  console.log(
    "lookup_hint",
    JSON.stringify({
      publishedPosts: feed.data?.length ?? 0,
      photos: photos.data?.length ?? 0,
      triedComposite: composite,
    }),
  );

  return fbid;
}

async function main() {
  const rows = await db
    .select()
    .from(pages)
    .where(ilike(pages.name, "%Big Six%"));
  if (!rows.length) {
    const all = await db
      .select({ id: pages.id, name: pages.name, pageId: pages.pageId })
      .from(pages);
    console.log(JSON.stringify({ error: "no_big_six", pages: all }, null, 2));
    process.exit(1);
  }
  const row = rows[0];
  if (!row) {
    process.exit(1);
  }
  const token = decryptToken(row.tokenEnc, row.keyVersion);
  if (LIST_ONLY) {
    const feed = await graphGet<{
      data?: Array<{
        id: string;
        permalink_url?: string;
        created_time?: string;
      }>;
    }>(
      `/${row.pageId}/published_posts`,
      token,
      { fields: "id,permalink_url,created_time", limit: "50" },
      "feed_list",
    );
    console.log(JSON.stringify({ posts: feed.data }, null, 2));
    return;
  }

  const objectId = await resolveObjectId(FBFID, row.pageId, token);
  console.log(
    JSON.stringify(
      {
        internalId: row.id,
        fbPageId: row.pageId,
        name: row.name,
        fbid: FBFID,
        objectId,
      },
      null,
      2,
    ),
  );

  try {
    const meta = await graphGet(
      `/${objectId}`,
      token,
      { fields: "id,from,created_time,permalink_url" },
      "object_check",
    );
    console.log("object", meta);
  } catch (e) {
    console.log("object_check_failed", String(e));
  }

  const result = await createComment(objectId, MSG, token);
  console.log(
    JSON.stringify(
      {
        ok: true,
        commentId: result.id,
        objectId,
        pageUuid: row.id,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => closeDb())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
    return closeDb();
  });
