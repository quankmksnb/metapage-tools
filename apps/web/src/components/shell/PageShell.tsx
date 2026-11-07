"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePageMeta } from "@/hooks/usePageMeta";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { slug: "inbox", label: "Hộp thư" },
  { slug: "schedule", label: "Lịch" },
  { slug: "rules", label: "Tự động" },
  { slug: "activity", label: "Hoạt động" },
  { slug: "settings", label: "Cài đặt" },
] as const;

export function PageShell({ children }: { children: ReactNode }) {
  const params = useParams<{ pageId: string }>();
  const pathname = usePathname();
  const pageId = params.pageId;
  const { meta, loading, pageName } = usePageMeta(pageId);
  const base = `/p/${pageId}`;

  return (
    <div className="app-shell">
      <div className="status-strip">
        <span className="status-strip-title">{loading ? "…" : pageName}</span>
        <StatusBadge
          tone={meta?.tokenValid ? "ok" : "error"}
          label={meta?.tokenValid ? "Token hợp lệ" : "Token lỗi"}
        />
        <StatusBadge
          tone={meta?.webhookSubscribed ? "ok" : "pending"}
          label={
            meta?.webhookSubscribed ? "Webhook: Đã nối" : "Webhook: Chưa nối"
          }
        />
        <Link href="/pages" className="status-strip-link">
          Đổi Page
        </Link>
      </div>
      <div className="app-body">
        <aside className="sidebar" aria-label="Điều hướng Page">
          <nav className="sidebar-nav">
            {NAV.map((item) => {
              const href = `${base}/${item.slug}`;
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={item.slug}
                  href={href}
                  className={active ? "nav-link active" : "nav-link"}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="app-content">
          <h1 className="page-title">{pageName}</h1>
          {children}
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {NAV.map((item) => {
          const href = `${base}/${item.slug}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={item.slug}
              href={href}
              className={active ? "bottom-link active" : "bottom-link"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
