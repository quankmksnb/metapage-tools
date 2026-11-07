import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/** Phiên bản key hiện tại — tăng khi rotate TOKEN_ENC_KEY. */
export const CURRENT_KEY_VERSION = 1;

function encryptionKey(): Buffer {
  return Buffer.from(env.TOKEN_ENC_KEY, "base64");
}

export type EncryptedToken = {
  tokenEnc: string;
  keyVersion: number;
};

/** Định dạng lưu: `iv:authTag:ciphertext` (base64). */
export function encryptToken(plaintext: string): EncryptedToken {
  const key = encryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const tokenEnc = [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
  return { tokenEnc, keyVersion: CURRENT_KEY_VERSION };
}

export function decryptToken(tokenEnc: string, keyVersion: number): string {
  if (keyVersion !== CURRENT_KEY_VERSION) {
    throw new Error(`Unsupported TOKEN_ENC_KEY version: ${keyVersion}`);
  }
  const parts = tokenEnc.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid token_enc format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}
