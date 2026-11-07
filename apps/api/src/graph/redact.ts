const SENSITIVE_KEYS = new Set([
  "access_token",
  "accessToken",
  "pageAccessToken",
  "token_enc",
  "tokenEnc",
  "appsecret_proof",
  "client_secret",
  "authorization",
]);

export function redactForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactForLog);
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[Redacted]";
    } else {
      out[key] = redactForLog(val);
    }
  }
  return out;
}
