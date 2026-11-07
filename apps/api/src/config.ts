function required(name: string): string {
  const v = process.env[name];
  if (!v) return "";
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  META_APP_ID: required("META_APP_ID"),
  META_APP_SECRET: required("META_APP_SECRET"),
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN ?? "change-me-webhook-verify",
  GRAPH_VERSION: "v25.0",
} as const;
