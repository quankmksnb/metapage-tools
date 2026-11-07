import { SettingsView } from "@/components/views/SettingsView";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <SettingsView pageId={pageId} />;
}
