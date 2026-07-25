import { BrandSettlementScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const [deal] = await knotDataSource.getCreatorDeals();
  return <BrandSettlementScreen settlement={deal.settlement} milestones={deal.milestones} />;
}
