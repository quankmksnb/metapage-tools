import { env } from "../config.js";

export type GraphError = {
  error?: { message: string; type: string; code: number };
};

/** Gọi Graph API — chỉ dùng Page access token từ caller */
export async function graphPost<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<T & GraphError> {
  const url = `https://graph.facebook.com/${env.GRAPH_VERSION}${path}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T & GraphError;
}

/** Comment hoặc reply — author là Page */
export async function postComment(
  objectId: string,
  message: string,
  pageAccessToken: string,
) {
  return graphPost<{ id?: string }>(
    `/${objectId}/comments`,
    { message },
    pageAccessToken,
  );
}
