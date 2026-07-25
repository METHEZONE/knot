import { notFound } from "next/navigation";
import { CreatorBrandDetailScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const deal = await knotDataSource.getCreatorDeal(brandId);
  if (!deal) {
    notFound();
  }

  return <CreatorBrandDetailScreen deal={deal} />;
}
