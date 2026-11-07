/** Biến tối thiểu để Zod parse config trong Vitest (không dùng secret thật). */
const testKey32 = Buffer.alloc(32, 7).toString("base64");

function setDefault(name: string, value: string): void {
  const current = process.env[name];
  if (current === undefined || current === "") {
    process.env[name] = value;
  }
}

setDefault("NODE_ENV", "test");
setDefault("APP_URL", "http://localhost:3000");
setDefault("WEB_ORIGIN", "http://localhost:3001");
setDefault("META_APP_ID", "test-app-id");
setDefault("META_APP_SECRET", "test-app-secret");
setDefault("META_VERIFY_TOKEN", "test-verify-token");
setDefault("GRAPH_VERSION", "v25.0");
/** Local Docker map 55432; CI Postgres service dùng 5432 — không ghi đè khi workflow đã set. */
setDefault(
  "DATABASE_URL",
  "postgresql://postgres:postgres@localhost:55432/metapage_tools",
);
setDefault("TOKEN_ENC_KEY", testKey32);
setDefault("SESSION_SECRET", "test-session-secret-at-least-32-chars");
setDefault("WORKER_ENABLED", "false");
setDefault("AUTO_REPLY_ENABLED", "false");
setDefault("META_OAUTH_CONFIG_ID", "");
