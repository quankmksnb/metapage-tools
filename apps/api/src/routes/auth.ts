import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "../auth/session.js";
import { env } from "../config.js";
import {
  completeOAuth,
  oauthDialogUrl,
  oauthRedirectUri,
} from "../services/meta-oauth.js";

const OAUTH_STATE_COOKIE = "oauth_state";

export async function registerAuthRoutes(app: FastifyInstance) {
  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest",
    parseOptions: {},
  });

  app.get("/auth/meta/status", async () => ({
    configured: Boolean(env.META_APP_ID && env.META_APP_SECRET),
    metaAppId: env.META_APP_ID,
    secretLooksPlaceholder: env.META_APP_SECRET.includes("THAY_BANG"),
    appUrl: env.APP_URL,
    redirectUri: oauthRedirectUri(),
    loginUrl: `${env.APP_URL.replace(/\/$/, "")}/auth/meta`,
    pagesApi: `${env.APP_URL.replace(/\/$/, "")}/api/pages`,
  }));

  app.get("/auth/meta", async (_req, reply) => {
    const state = randomBytes(24).toString("hex");
    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return reply.redirect(oauthDialogUrl(state));
  });

  app.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>("/auth/meta/callback", async (req, reply) => {
    if (req.query.error) {
      return reply.code(400).send({
        error: req.query.error,
        description: req.query.error_description,
      });
    }
    const { code, state } = req.query;
    const saved = req.cookies[OAUTH_STATE_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    if (!code || !state || !saved || state !== saved) {
      return reply.code(400).send({ error: "invalid_oauth_state" });
    }

    try {
      const result = await completeOAuth(code);
      const token = createSessionToken({
        accountId: result.accountId,
        metaUserId: result.metaUserId,
        email: result.email,
      });
      reply.setCookie(sessionCookieName, token, sessionCookieOptions());
      return reply.redirect(`${env.APP_URL.replace(/\/$/, "")}/auth/meta/done`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "oauth_failed";
      if (message === "admin_not_allowed") {
        return reply.code(403).send({
          error: "admin_not_allowed",
          hint: "Thêm email Facebook vào ADMIN_EMAILS trong .env",
        });
      }
      req.log.error({ err }, "oauth callback failed");
      return reply.code(502).send({ error: message });
    }
  });

  app.get("/auth/meta/done", async (req, reply) => {
    const session = req.cookies[sessionCookieName];
    if (!session) {
      return reply.redirect("/auth/meta");
    }
    reply.type("text/html; charset=utf-8");
    return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>PageDesk — đã kết nối</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem">
<h1>Đã kết nối Facebook</h1>
<p>Page token đã lưu mã hóa trong Postgres.</p>
<ul>
  <li><a href="/api/pages">GET /api/pages</a> — danh sách Page</li>
  <li><a href="/auth/meta/status">GET /auth/meta/status</a></li>
  <li><a href="/health">GET /health</a></li>
</ul>
<h2>Thử comment (curl)</h2>
<pre style="background:#f4f4f4;padding:1rem;overflow:auto">POST /api/pages/{id}/comments
{ "objectId": "POST_ID", "message": "Hello từ PageDesk" }</pre>
<p>Thay <code>{id}</code> bằng <code>id</code> trong JSON từ /api/pages (UUID nội bộ).</p>
</body></html>`;
  });

  app.post("/auth/meta/logout", async (_req, reply) => {
    reply.clearCookie(sessionCookieName, { path: "/" });
    return { ok: true };
  });
}
