"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { apiJson } from "@/lib/api";
import type { CommentRule } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type RuleFormState = {
  editingId: string | null;
  name: string;
  enabled: boolean;
  priority: number;
  matchType: CommentRule["matchType"];
  pattern: string;
  replyMode: CommentRule["replyMode"];
  templatesText: string;
  cooldownSeconds: number;
  maxPerUserPerDay: number;
};

const emptyForm = (): RuleFormState => ({
  editingId: null,
  name: "Rule mới",
  enabled: false,
  priority: 0,
  matchType: "contains",
  pattern: "xin chào",
  replyMode: "public",
  templatesText: "Cảm ơn bạn đã nhắn!",
  cooldownSeconds: 60,
  maxPerUserPerDay: 5,
});

function parseTemplates(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function RulesView({ pageId }: { pageId: string }) {
  const { push } = useToast();
  const [rules, setRules] = useState<CommentRule[] | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [sample, setSample] = useState("xin chào bạn nhé");
  const [dry, setDry] = useState<{
    matches: boolean;
    replyWouldBe: string | null;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (dialogOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [dialogOpen]);

  const load = useCallback(() => {
    setRules(null);
    apiJson<{ rules: CommentRule[] }>(`/api/pages/${pageId}/rules`)
      .then((d) => setRules(d.rules))
      .catch((e: Error) => push(e.message, "err"));
  }, [pageId, push]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const templates = parseTemplates(form.templatesText);
    if (!form.pattern.trim()) {
      setDry(null);
      return;
    }
    const t = setTimeout(() => {
      void apiJson<{
        matches: boolean;
        replyWouldBe: string | null;
      }>(`/api/pages/${pageId}/rules/dry-run`, {
        method: "POST",
        body: JSON.stringify({
          pattern: form.pattern,
          matchType: form.matchType,
          sampleText: sample,
          replyTemplates: templates.length ? templates : ["..."],
        }),
      })
        .then(setDry)
        .catch(() => setDry(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.pattern, form.matchType, form.templatesText, sample, pageId]);

  function openNew() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(rule: CommentRule) {
    setForm({
      editingId: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      matchType: rule.matchType,
      pattern: rule.pattern,
      replyMode: rule.replyMode,
      templatesText: rule.replyTemplates.join("\n"),
      cooldownSeconds: rule.cooldownSeconds,
      maxPerUserPerDay: rule.maxPerUserPerDay,
    });
    setDialogOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const templates = parseTemplates(form.templatesText);
    if (templates.length === 0) {
      push("Cần ít nhất một mẫu trả lời.", "err");
      return;
    }
    const body = {
      name: form.name,
      enabled: form.enabled,
      priority: form.priority,
      matchType: form.matchType,
      pattern: form.pattern,
      caseSensitive: false,
      replyTemplates: templates,
      replyMode: form.replyMode,
      cooldownSeconds: form.cooldownSeconds,
      maxPerUserPerDay: form.maxPerUserPerDay,
    };
    try {
      if (form.editingId) {
        await apiJson(`/api/pages/${pageId}/rules/${form.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        push("Đã cập nhật rule.");
      } else {
        await apiJson(`/api/pages/${pageId}/rules`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        push("Đã tạo rule (đang tắt — bật khi sẵn sàng).");
      }
      setDialogOpen(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "lỗi rule", "err");
    }
  }

  async function toggle(rule: CommentRule) {
    await apiJson(`/api/pages/${pageId}/rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    load();
  }

  async function remove(ruleId: string) {
    await apiJson(`/api/pages/${pageId}/rules/${ruleId}`, {
      method: "DELETE",
    });
    push("Đã xóa rule.");
    load();
  }

  const templateCount = parseTemplates(form.templatesText).length;

  return (
    <>
      <div className="card">
        <div className="card-header-row">
          <h2>Rule auto-reply</h2>
          <button type="button" className="btn" onClick={openNew}>
            Tạo rule
          </button>
        </div>
        {rules === null ? (
          <div className="skeleton skeleton-line" />
        ) : rules.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có rule.</p>
            <button type="button" className="btn" onClick={openNew}>
              Tạo rule đầu tiên
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tên</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>
                      <code className="mono">{rule.pattern}</code>
                    </td>
                    <td>
                      <StatusBadge
                        tone={rule.enabled ? "ok" : "off"}
                        label={rule.enabled ? "Đang bật" : "Tắt / nháp"}
                      />
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn btn-sm secondary"
                        onClick={() => openEdit(rule)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm secondary"
                        onClick={() => void toggle(rule)}
                      >
                        {rule.enabled ? "Tắt" : "Bật"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm destructive"
                        onClick={() => void remove(rule.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="dialog rule-dialog"
        aria-labelledby="rule-dialog-title"
        onClose={() => setDialogOpen(false)}
      >
        <div className="dialog-header">
          <h2 id="rule-dialog-title">
            {form.editingId ? "Sửa rule" : "Tạo rule"}
          </h2>
          <button
            type="button"
            className="btn btn-icon secondary"
            aria-label="Đóng"
            onClick={() => setDialogOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <form onSubmit={(ev) => void save(ev)} className="rule-dialog-form">
          <div className="rule-dialog-scroll form-stack">
            <div className="form-grid-2">
              <div>
                <label htmlFor="rule-name">Tên</label>
                <input
                  id="rule-name"
                  value={form.name}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, name: ev.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="rule-match">Kiểu khớp</label>
                <select
                  id="rule-match"
                  value={form.matchType}
                  onChange={(ev) =>
                    setForm((f) => ({
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
              value={form.pattern}
              onChange={(ev) =>
                setForm((f) => ({ ...f, pattern: ev.target.value }))
              }
            />
            <label htmlFor="rule-mode">Hành động khi khớp</label>
            <select
              id="rule-mode"
              value={form.replyMode}
              onChange={(ev) =>
                setForm((f) => ({
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
            <label htmlFor="rule-templates">
              Mẫu trả lời (mỗi dòng một biến thể)
            </label>
            <textarea
              id="rule-templates"
              rows={5}
              className="textarea-lg"
              value={form.templatesText}
              onChange={(ev) =>
                setForm((f) => ({ ...f, templatesText: ev.target.value }))
              }
            />
            {templateCount < 2 ? (
              <p className="hint-warn" role="alert">
                Chỉ {templateCount} mẫu — nên thêm 2–3 biến thể để tránh spam
                Meta.
              </p>
            ) : null}
            <label htmlFor="dry-sample">Thử với văn bản mẫu</label>
            <input
              id="dry-sample"
              value={sample}
              onChange={(ev) => setSample(ev.target.value)}
            />
            {dry ? (
              <p className="dry-result" aria-live="polite">
                {dry.matches
                  ? `Khớp → “${dry.replyWouldBe ?? ""}”`
                  : "Không khớp pattern."}
              </p>
            ) : null}
            <fieldset className="fieldset">
              <legend>Chặn spam</legend>
              <div className="form-grid-2">
                <div>
                  <label htmlFor="rule-cooldown">
                    Chờ giữa 2 lần trả lời (giây)
                  </label>
                  <input
                    id="rule-cooldown"
                    type="number"
                    min={0}
                    value={form.cooldownSeconds}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        cooldownSeconds: Number(ev.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="rule-max">Mỗi người tối đa mỗi ngày</label>
                  <input
                    id="rule-max"
                    type="number"
                    min={0}
                    value={form.maxPerUserPerDay}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        maxPerUserPerDay: Number(ev.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </fieldset>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, enabled: ev.target.checked }))
                }
              />
              Bật rule (chạy thật trên Facebook)
            </label>
          </div>
          <div className="dialog-footer btn-row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setDialogOpen(false)}
            >
              Huỷ
            </button>
            <button type="submit" className="btn">
              Lưu
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
