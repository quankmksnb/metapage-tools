"use client";

import { useToast } from "@/components/ui/Toast";
import { apiJson } from "@/lib/api";
import {
  NATIVE_SCHEDULE_MIN_MS,
  TZ_LABEL,
  defaultScheduleLocalValue,
  fmtTime,
  formatLead,
  relativeLeadMs,
} from "@/lib/datetime";
import type { ScheduledPostRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ScheduleView({ pageId }: { pageId: string }) {
  const { push } = useToast();
  const [scheduled, setScheduled] = useState<ScheduledPostRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [runAt, setRunAt] = useState(() => defaultScheduleLocalValue(15));
  const [busy, setBusy] = useState(false);
  const lead = relativeLeadMs(runAt);
  const canSchedule =
    message.trim() && lead !== null && lead >= NATIVE_SCHEDULE_MIN_MS;

  const load = useCallback(() => {
    setScheduled(null);
    apiJson<{ posts: ScheduledPostRow[] }>(`/api/pages/${pageId}/posts`)
      .then((d) => setScheduled(d.posts))
      .catch((e: Error) => push(e.message, "err"));
  }, [pageId, push]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSchedule || lead === null) return;
    const at = new Date(runAt);
    if (
      !confirm(
        `Lên lịch đăng bài?\n\n"${message.slice(0, 200)}"\n\nLúc: ${fmtTime(at.toISOString())} (${TZ_LABEL})`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/api/pages/${pageId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          message,
          runAt: at.toISOString(),
          mode: "native",
          kind: "text",
        }),
      });
      push("Đã lên lịch bài.");
      setMessage("");
      setRunAt(defaultScheduleLocalValue(15));
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "lỗi lịch", "err");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPost(postId: string) {
    await apiJson(`/api/pages/${pageId}/posts/${postId}/cancel`, {
      method: "POST",
      body: "{}",
    });
    push("Đã hủy.");
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Soạn bài lên lịch</h2>
        <form onSubmit={(ev) => void submit(ev)} className="form-stack">
          <label htmlFor="sched-msg">Nội dung</label>
          <textarea
            id="sched-msg"
            rows={3}
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
          />
          <label htmlFor="sched-at">Thời gian đăng</label>
          <input
            id="sched-at"
            type="datetime-local"
            value={runAt}
            onChange={(ev) => setRunAt(ev.target.value)}
            aria-describedby="sched-hint"
          />
          <p id="sched-hint" className="muted">
            {lead === null
              ? "Chọn giờ hợp lệ."
              : `${formatLead(lead)} · ${TZ_LABEL}`}
            {lead !== null && lead < NATIVE_SCHEDULE_MIN_MS ? (
              <span className="hint-warn"> — cần ít nhất 11 phút nữa.</span>
            ) : null}
          </p>
          <div className="btn-row">
            <button
              type="submit"
              className="btn"
              disabled={!canSchedule || busy}
            >
              {busy ? "Đang gửi…" : "Lên lịch"}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setRunAt(defaultScheduleLocalValue(15))}
            >
              +15 phút
            </button>
          </div>
        </form>
      </div>
      <div className="card">
        <h2>Timeline</h2>
        {scheduled === null ? (
          <div className="skeleton skeleton-line" />
        ) : scheduled.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có bài chờ đăng.</p>
          </div>
        ) : (
          <ul className="timeline">
            {scheduled.map((p) => (
              <li key={p.id} className="timeline-item">
                <span className="timeline-time">{fmtTime(p.runAt)}</span>
                <span className="timeline-status">{p.status}</span>
                <span>{(p.message ?? "").slice(0, 100)}</span>
                {p.status === "queued" ? (
                  <button
                    type="button"
                    className="btn btn-sm secondary"
                    onClick={() => void cancelPost(p.id)}
                  >
                    Hủy
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
