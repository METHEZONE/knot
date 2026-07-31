"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandPromotionWizard } from "@/features/dashboard/BrandPromotionWizard";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandPromotionWizard />}
    </AuthGate>
  );
}
