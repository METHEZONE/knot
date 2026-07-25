import { BrandProductScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const product = await knotDataSource.getBrandProduct();
  return <BrandProductScreen product={product} />;
}
