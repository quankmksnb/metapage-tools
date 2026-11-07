export type CommentRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchType: "contains" | "regex" | "exact";
  pattern: string;
  caseSensitive: boolean;
  replyTemplates: string[];
  replyMode: "public" | "private" | "hide" | "like";
  cooldownSeconds: number;
  maxPerUserPerDay: number;
};

export type ReplyLogRow = {
  id: string;
  commentId: string;
  commenterId: string | null;
  replyText: string;
  remoteCommentId: string | null;
  ruleId: string | null;
  createdAt: string;
};

export type WebhookEventRow = {
  id: string;
  eventId: string;
  status: string;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type ScheduledPostRow = {
  id: string;
  message: string | null;
  runAt: string;
  mode: string;
  status: string;
  remotePostId: string | null;
};

export type PublishedPostRow = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
};
