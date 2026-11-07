import { graphDelete, graphGet, graphPost } from "./client.js";

export type CommentCreated = { id: string };

export async function createComment(
  objectId: string,
  message: string,
  pageAccessToken: string,
): Promise<CommentCreated> {
  const path = `/${objectId}/comments`;
  const res = await graphPost<{ id?: string }>(
    path,
    pageAccessToken,
    { message },
    undefined,
    "comment_create",
  );
  if (!res.id) {
    throw new Error("Graph did not return comment id");
  }
  return { id: res.id };
}

export async function listComments(
  objectId: string,
  pageAccessToken: string,
  fields = "id,message,from,created_time",
) {
  return graphGet<{ data?: unknown[] }>(
    `/${objectId}/comments`,
    pageAccessToken,
    { fields },
    "comment_list",
  );
}

export async function hideComment(commentId: string, pageAccessToken: string) {
  return graphPost<{ success?: boolean }>(
    `/${commentId}`,
    pageAccessToken,
    { is_hidden: true },
    undefined,
    "comment_hide",
  );
}

export async function deleteComment(
  commentId: string,
  pageAccessToken: string,
) {
  return graphDelete<{ success?: boolean }>(
    `/${commentId}`,
    pageAccessToken,
    undefined,
    "comment_delete",
  );
}

export async function likeComment(commentId: string, pageAccessToken: string) {
  return graphPost<{ success?: boolean }>(
    `/${commentId}/likes`,
    pageAccessToken,
    {},
    undefined,
    "comment_like",
  );
}

/** Private reply — cần quyền messaging; cửa sổ ~7 ngày theo Meta. */
export async function privateReply(
  commentId: string,
  message: string,
  pageAccessToken: string,
) {
  return graphPost<{ id?: string }>(
    `/${commentId}/private_replies`,
    pageAccessToken,
    { message },
    undefined,
    "comment_private_reply",
  );
}
