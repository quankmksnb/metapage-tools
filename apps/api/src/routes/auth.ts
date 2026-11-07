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
  META_OAUTH_PAGE_SCOPES_SUGGESTED,
  completeOAuth,
  oauthDialogUrl,
  oauthLoginConfigured,
  oauthRedirectUri,
  usesLoginConfigId,
  usesOAuthScopes,
} from "../services/meta-oauth.js";

const OAUTH_STATE_COOKIE = "oauth_state";

/** Meta App Secret thường là hex; mật khẩu FB hay placeholder dễ nhầm. */
function metaAppSecretSuspicious(secret: string): boolean {
  if (secret.includes("THAY_BANG") || secret.length === 0) return true;
  if (secret.startsWith("@")) return true;
  return secret.length < 24;
}

function renderSetupHtml(payload: {
  redirectUri: string;
  oauthLoginReady: boolean;
  metaAppSecretSuspicious: boolean;
  databaseReady: boolean;
  usesScopes: boolean;
}): string {
  const tick = (ok: boolean) => (ok ? "✅" : "⬜");
  const loginHint = payload.usesScopes
    ? "<code>META_OAUTH_SCOPES</code> (app use case Page)"
    : "<code>META_OAUTH_CONFIG_ID</code> hoặc <code>META_OAUTH_SCOPES</code>";
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>PageDesk — thiết lập OAuth</title>
<meta http-equiv="refresh" content="15"></head>
<body style="font-family:system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5">
<h1>Thiết lập OAuth (Meta)</h1>
<p>Trang tự làm mới mỗi 15 giây. API: <a href="/auth/meta/status">/auth/meta/status</a></p>
<ol>
  <li>${tick(true)} <strong>Redirect URI</strong> trên Meta = <code>${payload.redirectUri}</code> (bạn đã lưu)</li>
  <li>${tick(!payload.metaAppSecretSuspicious)} <strong>META_APP_SECRET</strong> — App Secret thật từ Basic (hex), không phải mật khẩu Facebook. Sửa <code>.env</code> → restart <code>npm run dev</code>.</li>
  <li>${tick(payload.oauthLoginReady)} <strong>OAuth login</strong> — ${loginHint} trong <code>.env</code> → restart.</li>
  <li>${tick(payload.databaseReady)} <strong>Postgres</strong> — <code>docker compose up -d postgres</code>, <code>npm run db:migrate</code></li>
</ol>
<h2>App「Quản lý mọi thứ trên Trang」(PageDesk Pages)</h2>
<p>Không có menu Configurations — dùng <code>META_OAUTH_SCOPES</code>:</p>
<pre style="background:#f4f4f4;padding:1rem;overflow:auto">META_OAUTH_SCOPES=${META_OAUTH_PAGE_SCOPES_SUGGESTED}</pre>
<p>Meta: Dashboard → <strong>Tùy chỉnh use case Page</strong> → bật đủ quyền tương ứng.</p>
<p>Khi 3 ô trên đều ✅: <a href="/auth/meta"><strong>Bắt đầu đăng nhập</strong></a></p>
</body></html>`;
}

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
    metaAppSecretSuspicious: metaAppSecretSuspicious(env.META_APP_SECRET),
    oauthUsesConfigId: usesLoginConfigId(),
    oauthUsesScopes: usesOAuthScopes(),
    oauthLoginReady: oauthLoginConfigured(),
    metaOauthConfigIdSet: Boolean(env.META_OAUTH_CONFIG_ID),
    setupHint: oauthLoginConfigured()
      ? null
      : `Page use case: META_OAUTH_SCOPES=${META_OAUTH_PAGE_SCOPES_SUGGESTED} hoặc config_id từ Login for Business`,
    setupPage: `${env.APP_URL.replace(/\/$/, "")}/auth/meta/setup`,
    appUrl: env.APP_URL,
    redirectUri: oauthRedirectUri(),
    loginUrl: `${env.APP_URL.replace(/\/$/, "")}/auth/meta`,
    pagesApi: `${env.APP_URL.replace(/\/$/, "")}/api/pages`,
  }));

  app.get("/auth/meta/setup", async (_req, reply) => {
    let databaseReady = false;
    try {
      const { pingDb } = await import("../db/index.js");
      await pingDb();
      databaseReady = true;
    } catch {
      databaseReady = false;
    }
    reply.type("text/html; charset=utf-8");
    return renderSetupHtml({
      redirectUri: oauthRedirectUri(),
      oauthLoginReady: oauthLoginConfigured(),
      metaAppSecretSuspicious: metaAppSecretSuspicious(env.META_APP_SECRET),
      databaseReady,
      usesScopes: usesOAuthScopes(),
    });
  });

  app.get("/auth/meta", async (_req, reply) => {
    if (!oauthLoginConfigured()) {
      return reply.code(503).send({
        error: "missing_oauth_login_config",
        hint: `PageDesk Pages: đặt META_OAUTH_SCOPES=${META_OAUTH_PAGE_SCOPES_SUGGESTED} trong .env (không cần config_id)`,
        setup: `${env.APP_URL.replace(/\/$/, "")}/auth/meta/setup`,
        status: `${env.APP_URL.replace(/\/$/, "")}/auth/meta/status`,
      });
    }
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
