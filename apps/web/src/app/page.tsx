import { authLoginUrl } from "@/lib/api";

export default function HomePage() {
  const login = authLoginUrl();
  return (
    <div className="card">
      <h1>PageDesk Admin</h1>
      <p className="muted">
        Kết nối Facebook Page, quy tắc auto-reply, lịch đăng bài.
      </p>
      <p>
        <a className="btn" href={login}>
          Kết nối Facebook
        </a>
        <a className="btn secondary" href="/pages" style={{ marginLeft: 8 }}>
          Danh sách Page
        </a>
      </p>
      <p className="muted">
        Sau login Meta bạn sẽ về <code>/auth/meta/done</code> trên API ( port
        3000). Quay lại UI này để quản lý.
      </p>
    </div>
  );
}
