import { redirect } from "next/navigation";

export default async function PageIndex({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  redirect(`/p/${pageId}/inbox`);
}
