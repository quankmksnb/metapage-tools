import { Providers } from "@/app/providers";
import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const firaSans = Fira_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PageDesk",
  description: "Quản lý Facebook Page",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${firaSans.variable} ${firaCode.variable}`}>
        <Providers>
          <header className="topbar">
            <a href="/" className="brand">
              PageDesk
            </a>
            <nav>
              <a href="/pages">Pages</a>
            </nav>
          </header>
          <main className="container">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
