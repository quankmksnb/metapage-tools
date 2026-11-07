import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config.js";

const SESSION_COOKIE = "pagedesk_session";
const SESSION_DAYS = 14;

export type SessionPayload = {
  accountId: string;
  metaUserId: string;
  email?: string;
};

function sign(body: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(body)
    .digest("base64url");
}

export function createSessionToken(payload: SessionPayload): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp }),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function parseSessionToken(
  token: string | undefined,
): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload & { exp?: number };
    if (!parsed.accountId || !parsed.metaUserId) return null;
    if (
      parsed.exp !== undefined &&
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      accountId: parsed.accountId,
      metaUserId: parsed.metaUserId,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

export const sessionCookieName = SESSION_COOKIE;

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}
