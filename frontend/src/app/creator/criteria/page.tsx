import { CreatorCriteriaScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const criteria = await knotDataSource.getCreatorCriteria();
  return <CreatorCriteriaScreen criteria={criteria} />;
}
