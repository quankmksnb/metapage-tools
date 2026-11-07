"use client";

import { useToast } from "@/components/ui/Toast";
import { apiJson } from "@/lib/api";
import { fmtTime } from "@/lib/datetime";
import type { ReplyLogRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function InboxView({ pageId }: { pageId: string }) {
  const { push } = useToast();
  const [replies, setReplies] = useState<ReplyLogRow[] | null>(null);

  const load = useCallback(() => {
    setReplies(null);
    apiJson<{ replies: ReplyLogRow[] }>(`/api/pages/${pageId}/inbox`)
      .then((d) => setReplies(d.replies))
      .catch((e: Error) => push(e.message, "err"));
  }, [pageId, push]);

  useEffect(() => {
    load();
  }, [load]);

  if (replies === null) {
    return (
      <div className="card">
        <p className="muted">Đang tải hộp thư…</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Auto-reply đã gửi</h2>
      {replies.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có reply nào.</p>
          <p className="muted">
            Khi có comment khớp rule (và webhook hoạt động), log sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Comment ID</th>
                <th scope="col">Nội dung trả lời</th>
              </tr>
            </thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.id}>
                  <td>{fmtTime(r.createdAt)}</td>
                  <td>
                    <code className="mono">{r.commentId}</code>
                  </td>
                  <td>{r.replyText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
