import type { FastifyRequest } from "fastify";
import { parseSessionToken, sessionCookieName } from "./session.js";

export function getSession(req: FastifyRequest) {
  const raw = req.cookies[sessionCookieName];
  return parseSessionToken(raw);
}

export function requireSession(req: FastifyRequest) {
  const session = getSession(req);
  if (!session) {
    return { error: "unauthorized" as const, session: null };
  }
  return { error: null, session };
}
