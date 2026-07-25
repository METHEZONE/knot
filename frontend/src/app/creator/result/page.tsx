import { CreatorResultScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const deals = await knotDataSource.getCreatorDeals();
  return <CreatorResultScreen deals={deals} />;
}
