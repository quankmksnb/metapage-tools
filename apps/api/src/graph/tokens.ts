import { env } from "../config.js";
import { graphGet } from "./client.js";

const APP_TOKEN = () => `${env.META_APP_ID}|${env.META_APP_SECRET}`;

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  return graphGet<{
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  }>(
    "/oauth/access_token",
    APP_TOKEN(),
    {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
    "oauth_code_exchange",
  );
}

export async function exchangeLongLived(shortLivedUserToken: string) {
  return graphGet<{
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  }>(
    "/oauth/access_token",
    APP_TOKEN(),
    {
      grant_type: "fb_exchange_token",
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      fb_exchange_token: shortLivedUserToken,
    },
    "oauth_long_lived_exchange",
  );
}

export async function listMeAccounts(
  userAccessToken: string,
  fields = "id,name,access_token,category,tasks",
) {
  return graphGet<{
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      category?: string;
    }>;
  }>("/me/accounts", userAccessToken, { fields }, "oauth_list_accounts");
}

export async function debugToken(inputToken: string) {
  return graphGet<{
    data?: {
      app_id?: string;
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
    };
  }>("/debug_token", APP_TOKEN(), { input_token: inputToken }, "token_debug");
}

/** Dùng app token — không cần page token. */
export async function getAppAccessTokenCall<T extends Record<string, unknown>>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) {
  return graphGet<T>(path, APP_TOKEN(), query, "app_token_get");
}
