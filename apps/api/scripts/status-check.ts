import "../src/load-env.js";
import { db, closeDb } from "../src/db/index.js";
import { commentRules, pages, replyLog, webhookEvents } from "../src/db/schema.js";
import { env } from "../src/config.js";

async function main() {
  const pageRows = await db
    .select({
      name: pages.name,
      webhookSubscribed: pages.webhookSubscribed,
      tokenValid: pages.tokenValid,
    })
    .from(pages);
  const [ev] = await db.select({ id: webhookEvents.id }).from(webhookEvents).limit(1);
  const [rp] = await db.select({ id: replyLog.id }).from(replyLog).limit(1);
  const rules = await db
    .select({
      name: commentRules.name,
      enabled: commentRules.enabled,
      replyMode: commentRules.replyMode,
      pattern: commentRules.pattern,
    })
    .from(commentRules);

  console.log(
    JSON.stringify(
      {
        env: {
          AUTO_REPLY_ENABLED: env.AUTO_REPLY_ENABLED,
          WORKER_ENABLED: env.WORKER_ENABLED,
          APP_URL: env.APP_URL,
        },
        pages: pageRows,
        hasWebhookEventsInDb: Boolean(ev),
        hasReplyLogInDb: Boolean(rp),
        rules,
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
