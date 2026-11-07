"use client";

import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export type PageMeta = {
  id: string;
  pageId: string;
  name: string | null;
  tokenValid: boolean;
  webhookSubscribed: boolean;
};

export function usePageMeta(pageId: string) {
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiJson<{ pages: PageMeta[] }>("/api/pages")
      .then((data) => {
        if (cancelled) return;
        const row = data.pages.find((p) => p.id === pageId) ?? null;
        setMeta(row);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  return { meta, loading, pageName: meta?.name ?? "Page" };
}
