"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { BrandPromotionDetailScreen } from "@/product/ProductScreens";

export default function Page({ params }: { params: Promise<{ promotionId: string }> }) {
  const { promotionId } = use(params);
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandPromotionDetailScreen promotionId={promotionId} />}
    </AuthGate>
  );
}
