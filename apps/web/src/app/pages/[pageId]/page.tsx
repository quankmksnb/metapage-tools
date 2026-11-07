import { redirect } from "next/navigation";

export default async function LegacyPageRedirect({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  redirect(`/p/${pageId}/inbox`);
}
