import { describe, expect, it } from "vitest";
import { createSessionToken, parseSessionToken } from "./session.js";

describe("session token", () => {
  it("round-trips payload", () => {
    const token = createSessionToken({
      accountId: "acc-1",
      metaUserId: "meta-1",
      email: "a@example.com",
    });
    const parsed = parseSessionToken(token);
    expect(parsed?.accountId).toBe("acc-1");
    expect(parsed?.metaUserId).toBe("meta-1");
    expect(parsed?.email).toBe("a@example.com");
  });

  it("rejects tampered token", () => {
    const token = createSessionToken({ accountId: "a", metaUserId: "b" });
    const parsed = parseSessionToken(`${token}x`);
    expect(parsed).toBeNull();
  });
});
