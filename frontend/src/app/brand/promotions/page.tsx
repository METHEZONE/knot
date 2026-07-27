"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandPromotionListScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandPromotionListScreen />}
    </AuthGate>
  );
}
