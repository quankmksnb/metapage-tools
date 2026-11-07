import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageDesk",
  description: "Quản lý Facebook Page",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            PageDesk
          </a>
          <nav>
            <a href="/pages">Pages</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
