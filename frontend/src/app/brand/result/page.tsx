import { BrandResultScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ promotionId?: string; negotiationId?: string; agreementId?: string }>;
}) {
  const view = await knotDataSource.getNegotiation("brand", await searchParams);
  return <BrandResultScreen view={view} />;
}
