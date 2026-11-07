"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { apiJson, authLoginUrl } from "@/lib/api";
import type { PublishedPostRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function SettingsView({ pageId }: { pageId: string }) {
  const { push } = useToast();
  const { meta } = usePageMeta(pageId);
  const [published, setPublished] = useState<PublishedPostRow[] | null>(null);
  const [objectId, setObjectId] = useState("");
  const [commentMsg, setCommentMsg] = useState("Bình luận từ PageDesk");
  const stepsDone =
    (meta?.tokenValid ? 1 : 0) + (meta?.webhookSubscribed ? 1 : 0);
  const stepsTotal = 3;

  const load = useCallback(() => {
    apiJson<{ posts: PublishedPostRow[] }>(
      `/api/pages/${pageId}/published-posts`,
    )
      .then((d) => {
        setPublished(d.posts);
        if (d.posts[0]) setObjectId((cur) => cur || d.posts[0].id);
      })
      .catch(() => setPublished([]));
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  async function subscribe() {
    try {
      await apiJson(`/api/pages/${pageId}/subscribe`, {
        method: "POST",
        body: "{}",
      });
      push("Đã subscribe feed.");
      window.location.reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "subscribe failed", "err");
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!objectId.trim()) {
      push("Chọn bài đăng.", "err");
      return;
    }
    const preview = commentMsg.slice(0, 120);
    if (
      !confirm(
        `Đăng comment công khai dưới tên Page?\n\n"${preview}"\n\nTrên bài: ${objectId}`,
      )
    ) {
      return;
    }
    try {
      const res = await apiJson<{ id: string }>(
        `/api/pages/${pageId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            objectId: objectId.trim(),
            message: commentMsg,
          }),
        },
      );
      push(`Đã đăng comment (${res.id}).`);
    } catch (err) {
      push(err instanceof Error ? err.message : "comment failed", "err");
    }
  }

  return (
    <>
      <div className="card">
        <h2>Thiết lập</h2>
        <p className="muted">
          Hoàn tất thiết lập ({stepsDone}/{stepsTotal})
        </p>
        <ul className="checklist">
          <li>
            <StatusBadge
              tone={meta?.tokenValid ? "ok" : "error"}
              label={
                meta?.tokenValid ? "Token hợp lệ" : "Token cần kết nối lại"
              }
            />
            {!meta?.tokenValid ? (
              <a className="btn btn-sm" href={authLoginUrl()}>
                Kết nối lại
              </a>
            ) : null}
          </li>
          <li>
            <StatusBadge
              tone={meta?.webhookSubscribed ? "ok" : "pending"}
              label={
                meta?.webhookSubscribed
                  ? "Đã subscribe feed"
                  : "Chưa subscribe feed"
              }
            />
            {!meta?.webhookSubscribed ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void subscribe()}
              >
                Subscribe feed
              </button>
            ) : null}
          </li>
          <li className="muted">
            Webhook HTTPS public → <code>/webhooks/meta</code> (xem docs Meta)
          </li>
        </ul>
      </div>
      <div className="card">
        <h2>Đăng comment (Page)</h2>
        <form onSubmit={(ev) => void postComment(ev)} className="form-stack">
          <label htmlFor="post-pick">Chọn bài</label>
          <select
            id="post-pick"
            value={objectId}
            onChange={(ev) => setObjectId(ev.target.value)}
          >
            {(published ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {(p.message ?? "").slice(0, 60) || p.id}
              </option>
            ))}
          </select>
          <label htmlFor="comment-msg">Nội dung</label>
          <textarea
            id="comment-msg"
            rows={2}
            value={commentMsg}
            onChange={(ev) => setCommentMsg(ev.target.value)}
          />
          <button type="submit" className="btn">
            Đăng comment
          </button>
        </form>
      </div>
    </>
  );
}
