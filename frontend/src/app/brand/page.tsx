"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandDashboardScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {(context) => <BrandDashboardScreen context={context} />}
    </AuthGate>
  );
}
