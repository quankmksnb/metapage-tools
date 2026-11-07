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
                <td>{p.tokenValid ? "OK" : "Invalid"}</td>
                <td>{p.webhookSubscribed ? "On" : "Off"}</td>
                <td>
                  <Link href={`/pages/${p.id}`}>Quản lý</Link>
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
