import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "./signature.js";

describe("verifyMetaWebhookSignature", () => {
  const secret = "test-app-secret";
  const body = Buffer.from('{"object":"page"}');

  it("accepts valid sha256", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyMetaWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects wrong secret", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyMetaWebhookSignature(body, sig, "other")).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifyMetaWebhookSignature(body, undefined, secret)).toBe(false);
  });
});
