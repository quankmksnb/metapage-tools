export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatApiError(res.status, body));
  }
  return res.json() as Promise<T>;
}

export function authLoginUrl(): string {
  return `${API_BASE}/auth/meta`;
}

const API_ERROR_VI: Record<string, string> = {
  native_schedule_requires_11_minutes_ahead:
    "Giờ đăng phải cách hiện tại ít nhất 11 phút (lịch native của Meta).",
  "runAt must be in the future": "Chọn thời điểm trong tương lai.",
  login_required: "Hết phiên — đăng nhập lại Facebook.",
  invalid_schedule_time: "Thời gian đăng không hợp lệ.",
  invalid_body: "Dữ liệu không hợp lệ — kiểm tra nội dung và thời gian đăng.",
};

export function formatApiError(status: number, body: string): string {
  try {
    const data = JSON.parse(body) as {
      error?: string | { formErrors?: string[] };
      message?: string;
    };
    if (typeof data.error === "string") {
      return API_ERROR_VI[data.error] ?? data.error;
    }
    if (data.error && typeof data.error === "object") {
      return "Dữ liệu gửi lên không hợp lệ (kiểm tra thời gian và nội dung).";
    }
    if (data.message) return data.message;
  } catch {
    /* plain text */
  }
  if (status === 401) return API_ERROR_VI.login_required;
  return body.length > 180
    ? `${status}: ${body.slice(0, 180)}…`
    : `${status}: ${body}`;
}
