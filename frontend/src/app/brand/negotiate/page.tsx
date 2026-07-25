import { BrandNegotiationScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const view = await knotDataSource.getNegotiation("brand");
  const product = await knotDataSource.getBrandProduct();
  return <BrandNegotiationScreen view={view} product={product} />;
}
