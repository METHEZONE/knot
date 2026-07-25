import { RoleSignupScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const session = await knotDataSource.getRoleSession("brand");
  return <RoleSignupScreen role="brand" session={session} />;
}
