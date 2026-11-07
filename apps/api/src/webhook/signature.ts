import { createHmac, timingSafeEqual } from "node:crypto";

/** Meta: header `X-Hub-Signature-256: sha256=<hex>`. */
export function verifyMetaWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(received, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}
