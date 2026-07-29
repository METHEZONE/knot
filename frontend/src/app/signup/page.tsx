import { Suspense } from "react";
import { SignupScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <Suspense>
      <SignupScreen />
    </Suspense>
  );
}
