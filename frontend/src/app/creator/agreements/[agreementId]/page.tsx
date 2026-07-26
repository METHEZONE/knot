import { notFound } from "next/navigation";
import { CreatorBrandDetailScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  const deal = await knotDataSource.getCreatorDeal(agreementId);
  if (!deal) {
    notFound();
  }
  return <CreatorBrandDetailScreen deal={deal} />;
}
