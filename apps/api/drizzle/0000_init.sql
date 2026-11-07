CREATE TYPE "public"."job_status" AS ENUM('draft', 'queued', 'processing', 'posted', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('contains', 'regex', 'exact');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('text', 'link', 'photo', 'multi_photo');--> statement-breakpoint
CREATE TYPE "public"."reply_mode" AS ENUM('public', 'private', 'hide', 'like');--> statement-breakpoint
CREATE TYPE "public"."schedule_mode" AS ENUM('native', 'worker');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('user_long');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('pending', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "account_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_enc" text NOT NULL,
	"token_type" "token_type" DEFAULT 'user_long' NOT NULL,
	"expires_at" timestamp with time zone,
	"key_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meta_user_id" text NOT NULL,
	"name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"match_type" "match_type" DEFAULT 'contains' NOT NULL,
	"pattern" text NOT NULL,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"reply_templates" text[] NOT NULL,
	"reply_mode" "reply_mode" DEFAULT 'public' NOT NULL,
	"cooldown_seconds" integer DEFAULT 0 NOT NULL,
	"max_per_user_per_day" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid,
	"request" jsonb,
	"response" jsonb,
	"http_status" integer,
	"graph_code" integer,
	"graph_subcode" integer,
	"buc_usage" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text,
	"category" text,
	"token_enc" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"token_checked_at" timestamp with time zone,
	"token_valid" boolean DEFAULT true NOT NULL,
	"webhook_subscribed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"comment_id" text NOT NULL,
	"rule_id" uuid,
	"commenter_id" text,
	"reply_text" text NOT NULL,
	"remote_comment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"target_object_id" text NOT NULL,
	"message" text NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"remote_comment_id" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" "post_kind" DEFAULT 'text' NOT NULL,
	"message" text,
	"link" text,
	"media" jsonb,
	"run_at" timestamp with time zone NOT NULL,
	"mode" "schedule_mode" DEFAULT 'native' NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"remote_post_id" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid,
	"event_id" text NOT NULL,
	"raw" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" "webhook_event_status" DEFAULT 'pending' NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_rules" ADD CONSTRAINT "comment_rules_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_log" ADD CONSTRAINT "reply_log_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_log" ADD CONSTRAINT "reply_log_rule_id_comment_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."comment_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_comments" ADD CONSTRAINT "scheduled_comments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_tokens_account_type_unique" ON "account_tokens" USING btree ("account_id","token_type");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_meta_user_id_unique" ON "accounts" USING btree ("meta_user_id");--> statement-breakpoint
CREATE INDEX "comment_rules_page_id_priority_idx" ON "comment_rules" USING btree ("page_id","priority");--> statement-breakpoint
CREATE INDEX "job_logs_kind_created_at_idx" ON "job_logs" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_page_id_unique" ON "pages" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_log_comment_id_unique" ON "reply_log" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "scheduled_comments_status_run_at_idx" ON "scheduled_comments" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "scheduled_comments_page_id_idx" ON "scheduled_comments" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "scheduled_posts_status_run_at_idx" ON "scheduled_posts" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "scheduled_posts_page_id_idx" ON "scheduled_posts" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_event_id_unique" ON "webhook_events" USING btree ("event_id");