import { Suspense } from "react";
import { LoginScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
