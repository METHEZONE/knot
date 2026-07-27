"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandPromotionCreateScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandPromotionCreateScreen />}
    </AuthGate>
  );
}
