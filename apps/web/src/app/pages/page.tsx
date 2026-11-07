"use client";

import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type PageRow = {
  id: string;
  pageId: string;
  name: string | null;
  tokenValid: boolean;
  webhookSubscribed: boolean;
};

export default function PagesListPage() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ pages: PageRow[] }>("/api/pages")
      .then((data) => setPages(data.pages))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div>
      <h1>Facebook Pages</h1>
      <p className="muted">
        Chọn Page để quản lý rule, comment, lên lịch và inbox.
      </p>
      {error ? (
        <p className="error">
          {error} — <a href="/">Đăng nhập lại</a>
        </p>
      ) : null}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Token</th>
              <th>Webhook</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>{p.name ?? p.pageId}</td>
                <td>{p.tokenValid ? "Hợp lệ" : "Lỗi"}</td>
                <td>{p.webhookSubscribed ? "Đã nối" : "Chưa"}</td>
                <td>
                  <Link href={`/p/${p.id}/inbox`}>Mở</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages.length === 0 && !error ? (
          <p className="muted">Chưa có Page — kết nối OAuth trước.</p>
        ) : null}
      </div>
    </div>
  );
}
