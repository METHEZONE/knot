import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  redirect(`/creator/agreements/${dealId}`);
}
