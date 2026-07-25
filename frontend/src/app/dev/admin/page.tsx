import { DevAdminScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const overview = await knotDataSource.getDevOverview();
  return <DevAdminScreen overview={overview} />;
}
