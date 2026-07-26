import { BrandNegotiationScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ promotionId?: string; negotiationId?: string; agreementId?: string }>;
}) {
  const query = await searchParams;
  const view = await knotDataSource.getNegotiation("brand", query);
  const product = await knotDataSource.getBrandProduct(query.promotionId ?? view.promotionId);
  return <BrandNegotiationScreen view={view} product={product} />;
}
