import { ActivityView } from "@/components/views/ActivityView";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <ActivityView pageId={pageId} />;
}
