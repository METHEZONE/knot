"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { BrandPromotionDetail } from "@/features/dashboard/PromotionDetail";

export default function Page({ params }: { params: Promise<{ promotionId: string }> }) {
  const { promotionId } = use(params);
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandPromotionDetail promotionId={promotionId} />}
    </AuthGate>
  );
}
