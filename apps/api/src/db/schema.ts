import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tokenTypeEnum = pgEnum("token_type", ["user_long"]);

export const postKindEnum = pgEnum("post_kind", [
  "text",
  "link",
  "photo",
  "multi_photo",
]);

export const scheduleModeEnum = pgEnum("schedule_mode", ["native", "worker"]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "queued",
  "processing",
  "posted",
  "failed",
  "canceled",
]);

export const matchTypeEnum = pgEnum("match_type", [
  "contains",
  "regex",
  "exact",
]);

export const replyModeEnum = pgEnum("reply_mode", [
  "public",
  "private",
  "hide",
  "like",
]);

export const webhookEventStatusEnum = pgEnum("webhook_event_status", [
  "pending",
  "processed",
  "failed",
  "skipped",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metaUserId: text("meta_user_id").notNull(),
    name: text("name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("accounts_meta_user_id_unique").on(t.metaUserId)],
);

export const accountTokens = pgTable(
  "account_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenEnc: text("token_enc").notNull(),
    tokenType: tokenTypeEnum("token_type").notNull().default("user_long"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    keyVersion: integer("key_version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("account_tokens_account_type_unique").on(
      t.accountId,
      t.tokenType,
    ),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: text("page_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name"),
    category: text("category"),
    tokenEnc: text("token_enc").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    tokenCheckedAt: timestamp("token_checked_at", { withTimezone: true }),
    tokenValid: boolean("token_valid").notNull().default(true),
    webhookSubscribed: boolean("webhook_subscribed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("pages_page_id_unique").on(t.pageId)],
);

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    kind: postKindEnum("kind").notNull().default("text"),
    message: text("message"),
    link: text("link"),
    media: jsonb("media").$type<Record<string, unknown>[] | null>(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    mode: scheduleModeEnum("mode").notNull().default("native"),
    status: jobStatusEnum("status").notNull().default("draft"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    remotePostId: text("remote_post_id"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("scheduled_posts_status_run_at_idx").on(t.status, t.runAt),
    index("scheduled_posts_page_id_idx").on(t.pageId),
  ],
);

export const scheduledComments = pgTable(
  "scheduled_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    targetObjectId: text("target_object_id").notNull(),
    message: text("message").notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: jobStatusEnum("status").notNull().default("draft"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    remoteCommentId: text("remote_comment_id"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("scheduled_comments_status_run_at_idx").on(t.status, t.runAt),
    index("scheduled_comments_page_id_idx").on(t.pageId),
  ],
);

export const commentRules = pgTable(
  "comment_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    matchType: matchTypeEnum("match_type").notNull().default("contains"),
    pattern: text("pattern").notNull(),
    caseSensitive: boolean("case_sensitive").notNull().default(false),
    replyTemplates: text("reply_templates").array().notNull(),
    replyMode: replyModeEnum("reply_mode").notNull().default("public"),
    cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
    maxPerUserPerDay: integer("max_per_user_per_day").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comment_rules_page_id_priority_idx").on(t.pageId, t.priority)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").references(() => pages.id, {
      onDelete: "set null",
    }),
    eventId: text("event_id").notNull(),
    raw: jsonb("raw").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: webhookEventStatusEnum("status").notNull().default("pending"),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_event_id_unique").on(t.eventId)],
);

export const replyLog = pgTable(
  "reply_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    commentId: text("comment_id").notNull(),
    ruleId: uuid("rule_id").references(() => commentRules.id, {
      onDelete: "set null",
    }),
    commenterId: text("commenter_id"),
    replyText: text("reply_text").notNull(),
    remoteCommentId: text("remote_comment_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("reply_log_comment_id_unique").on(t.commentId)],
);

export const jobLogs = pgTable(
  "job_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    refId: uuid("ref_id"),
    request: jsonb("request"),
    response: jsonb("response"),
    httpStatus: integer("http_status"),
    graphCode: integer("graph_code"),
    graphSubcode: integer("graph_subcode"),
    bucUsage: jsonb("buc_usage"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("job_logs_kind_created_at_idx").on(t.kind, t.createdAt)],
);
