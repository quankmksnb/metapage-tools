/** Biến tối thiểu để Zod parse config trong Vitest (không dùng secret thật). */
const testKey32 = Buffer.alloc(32, 7).toString("base64");

Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  META_APP_ID: "test-app-id",
  META_APP_SECRET: "test-app-secret",
  META_VERIFY_TOKEN: "test-verify-token",
  GRAPH_VERSION: "v25.0",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:55432/metapage_tools",
  TOKEN_ENC_KEY: testKey32,
  SESSION_SECRET: "test-session-secret-at-least-32-chars",
  WORKER_ENABLED: "false",
  AUTO_REPLY_ENABLED: "false",
});
