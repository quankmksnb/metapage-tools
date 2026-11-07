import { RulesView } from "@/components/views/RulesView";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <RulesView pageId={pageId} />;
}
