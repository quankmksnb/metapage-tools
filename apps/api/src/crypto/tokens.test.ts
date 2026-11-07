import { describe, expect, it } from "vitest";
import { CURRENT_KEY_VERSION, decryptToken, encryptToken } from "./tokens.js";

describe("token encryption", () => {
  it("round-trips plaintext", () => {
    const secret = "EAAG-page-access-token-example";
    const { tokenEnc, keyVersion } = encryptToken(secret);
    expect(keyVersion).toBe(CURRENT_KEY_VERSION);
    expect(tokenEnc).not.toContain(secret);
    expect(decryptToken(tokenEnc, keyVersion)).toBe(secret);
  });

  it("fails decrypt when ciphertext is tampered", () => {
    const { tokenEnc, keyVersion } = encryptToken("token");
    const bad = tokenEnc.replace(/.$/, "X");
    expect(() => decryptToken(bad, keyVersion)).toThrow();
  });

  it("fails on unsupported key version", () => {
    const { tokenEnc } = encryptToken("token");
    expect(() => decryptToken(tokenEnc, 999)).toThrow(/Unsupported/);
  });
});
