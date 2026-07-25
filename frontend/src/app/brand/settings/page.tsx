import { RoleSettingsScreen } from "@/product/ProductScreens";
import { knotDataSource } from "@/product/dataSource";

export default async function Page() {
  const session = await knotDataSource.getRoleSession("brand");
  return <RoleSettingsScreen role="brand" session={session} />;
}
