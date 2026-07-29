import { NegotiationDetail } from "@/features/dashboard/NegotiationDetail";

export default async function Page({ params }: { params: Promise<{ negotiationId: string }> }) {
  const { negotiationId } = await params;
  return <NegotiationDetail negotiationId={negotiationId} />;
}
