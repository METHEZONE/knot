import { BrandResultScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const view = await knotDataSource.getNegotiation("brand");
  return <BrandResultScreen view={view} />;
}
