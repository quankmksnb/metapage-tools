import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../config.js";
import { appSecretProof } from "./proof.js";

describe("appSecretProof", () => {
  it("matches Meta HMAC-SHA256 hex", () => {
    const token = "page-access-token-sample";
    const expected = createHmac("sha256", env.META_APP_SECRET)
      .update(token)
      .digest("hex");
    expect(appSecretProof(token)).toBe(expected);
  });
});
