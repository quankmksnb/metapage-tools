export const NATIVE_SCHEDULE_MIN_MS = 11 * 60 * 1000;
export const TZ_LABEL = "Asia/Ho_Chi_Minh";

export function defaultScheduleLocalValue(minutesAhead = 15): string {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { timeZone: TZ_LABEL });
  } catch {
    return iso;
  }
}

export function relativeLeadMs(runAtLocal: string): number | null {
  const runAt = new Date(runAtLocal);
  if (Number.isNaN(runAt.getTime())) return null;
  return runAt.getTime() - Date.now();
}

export function formatLead(ms: number): string {
  if (ms <= 0) return "đã qua hoặc ngay bây giờ";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `còn khoảng ${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `còn khoảng ${h} giờ ${m} phút` : `còn khoảng ${h} giờ`;
}
