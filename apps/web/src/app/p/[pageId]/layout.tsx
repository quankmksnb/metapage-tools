import { PageShell } from "@/components/shell/PageShell";
import type { ReactNode } from "react";

export default function PageWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PageShell>{children}</PageShell>;
}
