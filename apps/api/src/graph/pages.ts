import { graphDelete, graphGet, graphPost } from "./client.js";

export type FeedPostInput = {
  message?: string;
  link?: string;
  published?: boolean;
  scheduled_publish_time?: number;
  attached_media?: { media_fbid: string }[];
};

export async function createFeedPost(
  pageId: string,
  input: FeedPostInput,
  pageAccessToken: string,
) {
  return graphPost<{ id?: string }>(
    `/${pageId}/feed`,
    pageAccessToken,
    input,
    undefined,
    "page_feed_post",
  );
}

export async function createPhotoPost(
  pageId: string,
  params: {
    url?: string;
    caption?: string;
    published?: boolean;
    scheduled_publish_time?: number;
  },
  pageAccessToken: string,
) {
  return graphPost<{ id?: string; post_id?: string }>(
    `/${pageId}/photos`,
    pageAccessToken,
    params,
    undefined,
    "page_photo_post",
  );
}

/** Từng ảnh unpublished → attached_media trên feed post. */
export async function uploadUnpublishedPhoto(
  pageId: string,
  imageUrl: string,
  pageAccessToken: string,
) {
  return graphPost<{ id?: string }>(
    `/${pageId}/photos`,
    pageAccessToken,
    { url: imageUrl, published: false },
    undefined,
    "page_photo_unpublished",
  );
}

export async function createMultiPhotoPost(
  pageId: string,
  photoIds: string[],
  message: string,
  pageAccessToken: string,
) {
  const attached_media = photoIds.map((id) => ({ media_fbid: id }));
  return createFeedPost(
    pageId,
    { message, attached_media, published: true },
    pageAccessToken,
  );
}

export async function schedulePost(
  pageId: string,
  message: string,
  scheduledPublishTimeUnix: number,
  pageAccessToken: string,
) {
  return createFeedPost(
    pageId,
    {
      message,
      published: false,
      scheduled_publish_time: scheduledPublishTimeUnix,
    },
    pageAccessToken,
  );
}

export async function getPost(
  postId: string,
  pageAccessToken: string,
  fields = "id,message,created_time,scheduled_publish_time",
) {
  return graphGet<Record<string, unknown>>(
    `/${postId}`,
    pageAccessToken,
    { fields },
    "page_get_post",
  );
}

export async function deletePost(postId: string, pageAccessToken: string) {
  return graphDelete<{ success?: boolean }>(
    `/${postId}`,
    pageAccessToken,
    undefined,
    "page_delete_post",
  );
}
