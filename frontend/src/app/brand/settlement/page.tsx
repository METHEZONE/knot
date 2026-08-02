import { BrandSettlementEmptyScreen, BrandSettlementScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ agreementId?: string }>;
}) {
  const { agreementId } = await searchParams;
  const deal = await knotDataSource.getBrandSettlementDeal(agreementId).catch((error) => {
    const message = error instanceof Error ? error.message : "Settlement is not ready yet.";
    return { error: message };
  });
  if ("error" in deal) {
    return <BrandSettlementEmptyScreen message={deal.error} />;
  }
  return (
    <BrandSettlementScreen
      settlement={deal.settlement}
      milestones={deal.milestones}
      agreementId={deal.agreementId ?? agreementId ?? ""}
    />
  );
}
