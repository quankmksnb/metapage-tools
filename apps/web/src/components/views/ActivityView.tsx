"use client";

import { useToast } from "@/components/ui/Toast";
import { apiJson } from "@/lib/api";
import { fmtTime } from "@/lib/datetime";
import type { WebhookEventRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ActivityView({ pageId }: { pageId: string }) {
  const { push } = useToast();
  const [events, setEvents] = useState<WebhookEventRow[] | null>(null);

  const load = useCallback(() => {
    setEvents(null);
    apiJson<{ events: WebhookEventRow[] }>(`/api/pages/${pageId}/inbox`)
      .then((d) => setEvents(d.events))
      .catch((e: Error) => push(e.message, "err"));
  }, [pageId, push]);

  useEffect(() => {
    load();
  }, [load]);

  if (events === null) {
    return (
      <div className="card">
        <p className="muted">Đang tải…</p>
        <div className="skeleton skeleton-line" />
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Webhook & xử lý</h2>
      <p className="muted">
        Log kỹ thuật — dùng khi debug tunnel / auto-reply.
      </p>
      {events.length === 0 ? (
        <div className="empty-state">
          <p>Chưa nhận webhook.</p>
          <p className="muted">Cần HTTPS public trỏ về API và cấu hình Meta.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Nhận lúc</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{fmtTime(ev.receivedAt)}</td>
                  <td>{ev.status}</td>
                  <td>{ev.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
