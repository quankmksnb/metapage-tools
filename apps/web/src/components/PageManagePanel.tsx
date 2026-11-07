"use client";

import { apiJson, authLoginUrl } from "@/lib/api";
import type {
  CommentRule,
  PublishedPostRow,
  ReplyLogRow,
  ScheduledPostRow,
  WebhookEventRow,
} from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

type RuleFormState = {
  editingId: string | null;
  name: string;
  enabled: boolean;
  priority: number;
  matchType: CommentRule["matchType"];
  pattern: string;
  replyMode: CommentRule["replyMode"];
  template: string;
  cooldownSeconds: number;
  maxPerUserPerDay: number;
};

const emptyRuleForm = (): RuleFormState => ({
  editingId: null,
  name: "Rule mới",
  enabled: true,
  priority: 0,
  matchType: "contains",
  pattern: "xin chào",
  replyMode: "public",
  template: "Cảm ơn bạn đã nhắn!",
  cooldownSeconds: 60,
  maxPerUserPerDay: 5,
});

const NATIVE_SCHEDULE_MIN_MS = 11 * 60 * 1000;

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function defaultScheduleLocalValue(minutesAhead = 15) {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PageManagePanel({ pageId }: { pageId: string }) {
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [replies, setReplies] = useState<ReplyLogRow[]>([]);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPostRow[]>([]);
  const [published, setPublished] = useState<PublishedPostRow[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"ok" | "err">("ok");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [testSample, setTestSample] = useState("xin chào bạn nhé");
  const [objectId, setObjectId] = useState("");
  const [commentMsg, setCommentMsg] = useState("Bình luận từ PageDesk");
  const [postMessage, setPostMessage] = useState("");
  const [postRunAt, setPostRunAt] = useState(() =>
    defaultScheduleLocalValue(15),
  );

  const showFlash = (text: string, tone: "ok" | "err" = "ok") => {
    setFlash(text);
    setFlashTone(tone);
  };

  const reload = useCallback(() => {
    Promise.all([
      apiJson<{ rules: CommentRule[] }>(`/api/pages/${pageId}/rules`),
      apiJson<{ replies: ReplyLogRow[]; events: WebhookEventRow[] }>(
        `/api/pages/${pageId}/inbox`,
      ),
      apiJson<{ posts: ScheduledPostRow[] }>(`/api/pages/${pageId}/posts`),
      apiJson<{ posts: PublishedPostRow[] }>(
        `/api/pages/${pageId}/published-posts`,
      ).catch(() => ({ posts: [] as PublishedPostRow[] })),
    ])
      .then(([r, inbox, posts, pub]) => {
        setRules(r.rules);
        setReplies(inbox.replies);
        setEvents(inbox.events);
        setScheduled(posts.posts);
        setPublished(pub.posts);
        if (pub.posts[0]) {
          setObjectId((cur) => cur || pub.posts[0].id);
        }
      })
      .catch((e: Error) => {
        setFlash(e.message);
        setFlashTone("err");
      });
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
      showFlash("Đã subscribe feed.");
      reload();
    } catch (e) {
      showFlash(e instanceof Error ? e.message : "subscribe failed", "err");
    }
  }

  function loadRuleForEdit(rule: CommentRule) {
    setRuleForm({
      editingId: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      matchType: rule.matchType,
      pattern: rule.pattern,
      replyMode: rule.replyMode,
      template: rule.replyTemplates[0] ?? "",
      cooldownSeconds: rule.cooldownSeconds,
      maxPerUserPerDay: rule.maxPerUserPerDay,
    });
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: ruleForm.name,
      enabled: ruleForm.enabled,
      priority: ruleForm.priority,
      matchType: ruleForm.matchType,
      pattern: ruleForm.pattern,
      caseSensitive: false,
      replyTemplates: [ruleForm.template],
      replyMode: ruleForm.replyMode,
      cooldownSeconds: ruleForm.cooldownSeconds,
      maxPerUserPerDay: ruleForm.maxPerUserPerDay,
    };
    try {
      if (ruleForm.editingId) {
        await apiJson(`/api/pages/${pageId}/rules/${ruleForm.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        showFlash("Đã cập nhật rule.");
      } else {
        await apiJson(`/api/pages/${pageId}/rules`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        showFlash("Đã tạo rule.");
      }
      setRuleForm(emptyRuleForm());
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "rule failed", "err");
    }
  }

  async function toggleRule(rule: CommentRule) {
    try {
      await apiJson(`/api/pages/${pageId}/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "toggle failed", "err");
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Xóa rule này?")) return;
    try {
      await apiJson(`/api/pages/${pageId}/rules/${ruleId}`, {
        method: "DELETE",
      });
      showFlash("Đã xóa rule.");
      if (ruleForm.editingId === ruleId) setRuleForm(emptyRuleForm());
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "delete failed", "err");
    }
  }

  async function testRule(ruleId: string) {
    try {
      const res = await apiJson<{
        matches: boolean;
        replyWouldBe: string | null;
      }>(`/api/pages/${pageId}/rules/${ruleId}/test`, {
        method: "POST",
        body: JSON.stringify({ sampleText: testSample }),
      });
      showFlash(
        res.matches
          ? `Khớp → sẽ trả lời: "${res.replyWouldBe ?? ""}"`
          : "Không khớp rule.",
        res.matches ? "ok" : "err",
      );
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "test failed", "err");
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!objectId.trim()) {
      showFlash("Chọn bài viết hoặc nhập objectId.", "err");
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
      showFlash(`Đã đăng comment (id ${res.id}).`);
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "comment failed", "err");
    }
  }

  async function schedulePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postMessage.trim() || !postRunAt) {
      showFlash("Nhập nội dung và thời gian đăng.", "err");
      return;
    }
    const runAt = new Date(postRunAt);
    if (Number.isNaN(runAt.getTime())) {
      showFlash("Thời gian không hợp lệ.", "err");
      return;
    }
    const lead = runAt.getTime() - Date.now();
    if (lead <= 0) {
      showFlash("Chọn thời điểm trong tương lai.", "err");
      return;
    }
    if (lead < NATIVE_SCHEDULE_MIN_MS) {
      showFlash(
        `Cần ít nhất 11 phút nữa (bạn chọn còn ~${Math.max(1, Math.round(lead / 60_000))} phút). Gợi ý: bấm "Đặt +15 phút".`,
        "err",
      );
      return;
    }
    setScheduleBusy(true);
    try {
      await apiJson(`/api/pages/${pageId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          message: postMessage,
          runAt: runAt.toISOString(),
          mode: "native",
          kind: "text",
        }),
      });
      showFlash(
        `Đã lên lịch bài lúc ${fmtTime(runAt.toISOString())} — xem bảng bên dưới.`,
      );
      setPostMessage("");
      setPostRunAt(defaultScheduleLocalValue(15));
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "schedule failed", "err");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function cancelPost(postId: string) {
    try {
      await apiJson(`/api/pages/${pageId}/posts/${postId}/cancel`, {
        method: "POST",
        body: "{}",
      });
      showFlash("Đã hủy lịch.");
      reload();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "cancel failed", "err");
    }
  }

  return (
    <div>
      <h1>Quản lý Page</h1>
      <p className="muted">UUID: {pageId}</p>
      {flash ? (
        <p className={flashTone === "ok" ? "flash" : "flash flash-err"}>
          {flash}
        </p>
      ) : null}

      <div className="card">
        <h2>Webhook</h2>
        <p className="muted">
          Cần HTTPS public trỏ về API <code>/webhooks/meta</code>. Subscribe cần{" "}
          <code>pages_manage_metadata</code> — thêm scope rồi{" "}
          <a href={authLoginUrl()}>đăng nhập lại</a>. Bật{" "}
          <code>AUTO_REPLY_ENABLED</code> + <code>WORKER_ENABLED</code> trên
          API.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => void subscribeWebhook()}
        >
          Subscribe feed
        </button>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>{ruleForm.editingId ? "Sửa rule" : "Tạo rule auto-reply"}</h2>
          <form onSubmit={(ev) => void saveRule(ev)} className="form-stack">
            <label htmlFor="rule-name">Tên</label>
            <input
              id="rule-name"
              value={ruleForm.name}
              onChange={(ev) =>
                setRuleForm((f) => ({ ...f, name: ev.target.value }))
              }
            />
            <div className="row-2">
              <div>
                <label htmlFor="rule-priority">Ưu tiên (thấp = trước)</label>
                <input
                  id="rule-priority"
                  type="number"
                  min={0}
                  value={ruleForm.priority}
                  onChange={(ev) =>
                    setRuleForm((f) => ({
                      ...f,
                      priority: Number(ev.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="rule-match">Kiểu khớp</label>
                <select
                  id="rule-match"
                  value={ruleForm.matchType}
                  onChange={(ev) =>
                    setRuleForm((f) => ({
                      ...f,
                      matchType: ev.target.value as CommentRule["matchType"],
                    }))
                  }
                >
                  <option value="contains">contains</option>
                  <option value="exact">exact</option>
                  <option value="regex">regex</option>
                </select>
              </div>
            </div>
            <label htmlFor="rule-pattern">Pattern</label>
            <input
              id="rule-pattern"
              value={ruleForm.pattern}
              onChange={(ev) =>
                setRuleForm((f) => ({ ...f, pattern: ev.target.value }))
              }
            />
            <label htmlFor="rule-reply">Nội dung trả lời</label>
            <textarea
              id="rule-reply"
              rows={2}
              value={ruleForm.template}
              onChange={(ev) =>
                setRuleForm((f) => ({ ...f, template: ev.target.value }))
              }
            />
            <label htmlFor="rule-mode">Hành động</label>
            <select
              id="rule-mode"
              value={ruleForm.replyMode}
              onChange={(ev) =>
                setRuleForm((f) => ({
                  ...f,
                  replyMode: ev.target.value as CommentRule["replyMode"],
                }))
              }
            >
              <option value="public">Trả lời public</option>
              <option value="private">Inbox riêng</option>
              <option value="hide">Ẩn comment</option>
              <option value="like">Like comment</option>
            </select>
            <div className="row-2">
              <div>
                <label htmlFor="rule-cooldown">Cooldown (giây)</label>
                <input
                  id="rule-cooldown"
                  type="number"
                  min={0}
                  value={ruleForm.cooldownSeconds}
                  onChange={(ev) =>
                    setRuleForm((f) => ({
                      ...f,
                      cooldownSeconds: Number(ev.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="rule-max-day">Tối đa / user / ngày</label>
                <input
                  id="rule-max-day"
                  type="number"
                  min={0}
                  value={ruleForm.maxPerUserPerDay}
                  onChange={(ev) =>
                    setRuleForm((f) => ({
                      ...f,
                      maxPerUserPerDay: Number(ev.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ruleForm.enabled}
                onChange={(ev) =>
                  setRuleForm((f) => ({ ...f, enabled: ev.target.checked }))
                }
              />
              Bật rule
            </label>
            <div className="btn-row">
              <button type="submit" className="btn">
                {ruleForm.editingId ? "Cập nhật" : "Lưu rule"}
              </button>
              {ruleForm.editingId ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setRuleForm(emptyRuleForm())}
                >
                  Hủy sửa
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="card">
          <h2>Rule đang có ({rules.length})</h2>
          <label htmlFor="test-sample">Văn bản test</label>
          <input
            id="test-sample"
            value={testSample}
            onChange={(ev) => setTestSample(ev.target.value)}
          />
          {rules.length === 0 ? (
            <p className="muted">Chưa có rule.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Pattern</th>
                  <th>Mode</th>
                  <th>Bật</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>
                      <code>{rule.pattern}</code>
                    </td>
                    <td>{rule.replyMode}</td>
                    <td>{rule.enabled ? "✓" : "—"}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void testRule(rule.id)}
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => loadRuleForEdit(rule)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void toggleRule(rule)}
                      >
                        {rule.enabled ? "Tắt" : "Bật"}
                      </button>
                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => void deleteRule(rule.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Comment dưới tên Page</h2>
          <form onSubmit={(ev) => void postComment(ev)} className="form-stack">
            <label htmlFor="post-pick">Bài gần đây (Graph)</label>
            <select
              id="post-pick"
              value={objectId}
              onChange={(ev) => setObjectId(ev.target.value)}
            >
              {published.length === 0 ? (
                <option value="">— Không tải được / chưa có bài —</option>
              ) : (
                published.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmtTime(p.created_time)} —{" "}
                    {(p.message ?? "").slice(0, 60) || p.id}
                  </option>
                ))
              )}
            </select>
            <label htmlFor="object-id">Object ID (sửa tay nếu cần)</label>
            <input
              id="object-id"
              value={objectId}
              onChange={(ev) => setObjectId(ev.target.value)}
            />
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

        <div className="card">
          <h2>Lên lịch đăng bài</h2>
          <p className="muted">
            Chế độ <strong>native</strong> (Meta): giờ đăng phải cách hiện tại{" "}
            <strong>≥ 11 phút</strong>. Bài sẽ xuất hiện trên Page Big Six đúng
            giờ.
          </p>
          <form onSubmit={(ev) => void schedulePost(ev)} className="form-stack">
            <label htmlFor="post-msg">Nội dung</label>
            <textarea
              id="post-msg"
              rows={3}
              value={postMessage}
              onChange={(ev) => setPostMessage(ev.target.value)}
            />
            <label htmlFor="post-at">Thời gian đăng</label>
            <input
              id="post-at"
              type="datetime-local"
              value={postRunAt}
              onChange={(ev) => setPostRunAt(ev.target.value)}
            />
            <div className="btn-row">
              <button type="submit" className="btn" disabled={scheduleBusy}>
                {scheduleBusy ? "Đang gửi…" : "Lên lịch"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPostRunAt(defaultScheduleLocalValue(15))}
              >
                Đặt +15 phút
              </button>
            </div>
          </form>
          <h3>Bài đã lên lịch ({scheduled.length})</h3>
          {scheduled.length === 0 ? (
            <p className="muted">
              Chưa có — sau khi lên lịch thành công sẽ hiện ở đây.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Chạy lúc</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scheduled.map((p) => (
                  <tr key={p.id}>
                    <td>{(p.message ?? "").slice(0, 80)}</td>
                    <td>{fmtTime(p.runAt)}</td>
                    <td>{p.status}</td>
                    <td>
                      {p.status === "queued" ? (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => void cancelPost(p.id)}
                        >
                          Hủy
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Inbox</h2>
        <h3>Auto-reply đã gửi</h3>
        {replies.length === 0 ? (
          <p className="muted">Chưa có reply log.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Comment</th>
                <th>Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.id}>
                  <td>{fmtTime(r.createdAt)}</td>
                  <td>
                    <code>{r.commentId}</code>
                  </td>
                  <td>{r.replyText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3>Webhook events</h3>
        {events.length === 0 ? (
          <p className="muted">Chưa nhận webhook (cần tunnel + Meta).</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nhận</th>
                <th>Status</th>
                <th>Lỗi</th>
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
        )}
      </div>
    </div>
  );
}
