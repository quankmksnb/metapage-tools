import { InboxView } from "@/components/views/InboxView";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <InboxView pageId={pageId} />;
}
