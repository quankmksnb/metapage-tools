"use client";

import { PageManagePanel } from "@/components/PageManagePanel";
import { useParams } from "next/navigation";

export default function PageDetailPage() {
  const params = useParams<{ pageId: string }>();
  return <PageManagePanel pageId={params.pageId} />;
}
