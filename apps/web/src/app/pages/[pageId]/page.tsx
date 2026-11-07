"use client";

import { apiJson } from "@/lib/api";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function PageDetailPage() {
  const params = useParams<{ pageId: string }>();
  const pageId = params.pageId;

  const [rules, setRules] = useState<unknown[]>([]);
  const [inbox, setInbox] = useState<{
    replies: unknown[];
    events: unknown[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pattern, setPattern] = useState("xin chào");
  const [template, setTemplate] = useState("Cảm ơn bạn đã nhắn!");

  const reload = useCallback(() => {
    Promise.all([
      apiJson<{ rules: unknown[] }>(`/api/pages/${pageId}/rules`),
      apiJson<{ replies: unknown[]; events: unknown[] }>(
        `/api/pages/${pageId}/inbox`,
      ),
    ])
      .then(([r, i]) => {
        setRules(r.rules);
        setInbox(i);
      })
      .catch((e: Error) => setMessage(e.message));
  }, [pageId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function subscribeWebhook() {
    try {
      await apiJson(`/api/pages/${pageId}/subscribe`, {
        method: "POST",
        body: "{}",
      });
      setMessage("Đã gọi subscribe feed.");
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "subscribe failed");
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiJson(`/api/pages/${pageId}/rules`, {
        method: "POST",
        body: JSON.stringify({
          name: "Rule UI",
          pattern,
          matchType: "contains",
          replyTemplates: [template],
          replyMode: "public",
          cooldownSeconds: 60,
        }),
      });
      setMessage("Đã tạo rule.");
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "rule failed");
    }
  }

  return (
    <div>
      <h1>Quản lý Page</h1>
      <p className="muted">UUID: {pageId}</p>
      {message ? <p className="error">{message}</p> : null}

      <div className="card">
        <h2>Webhook</h2>
        <p className="muted">
          Cần HTTPS public trỏ về API <code>/webhooks/meta</code> trên Meta.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => void subscribeWebhook()}
        >
          Subscribe feed
        </button>
      </div>

      <div className="card">
        <h2>Tạo rule auto-reply</h2>
        <form onSubmit={(e) => void createRule(e)}>
          <label htmlFor="pattern">Pattern (contains)</label>
          <input
            id="pattern"
            value={pattern}
            onChange={(ev) => setPattern(ev.target.value)}
          />
          <label htmlFor="template">Reply</label>
          <textarea
            id="template"
            rows={2}
            value={template}
            onChange={(ev) => setTemplate(ev.target.value)}
          />
          <p className="muted">
            Bật <code>AUTO_REPLY_ENABLED=true</code> trong .env API.
          </p>
          <button type="submit" className="btn">
            Lưu rule
          </button>
        </form>
        <p>Rules: {rules.length}</p>
      </div>

      <div className="card">
        <h2>Inbox (reply log)</h2>
        <pre style={{ fontSize: 12, overflow: "auto" }}>
          {JSON.stringify(inbox?.replies ?? [], null, 2)}
        </pre>
        <h3>Webhook events</h3>
        <pre style={{ fontSize: 12, overflow: "auto" }}>
          {JSON.stringify(inbox?.events ?? [], null, 2)}
        </pre>
      </div>
    </div>
  );
}
