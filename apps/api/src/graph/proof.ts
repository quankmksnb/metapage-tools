import { createHmac } from "node:crypto";
import { env } from "../config.js";

/** Meta appsecret_proof = HMAC-SHA256(access_token, app_secret) hex. */
export function appSecretProof(accessToken: string): string {
  return createHmac("sha256", env.META_APP_SECRET)
    .update(accessToken)
    .digest("hex");
}
