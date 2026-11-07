import { ScheduleView } from "@/components/views/ScheduleView";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <ScheduleView pageId={pageId} />;
}
