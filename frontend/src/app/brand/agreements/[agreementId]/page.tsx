"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { BrandAgreementDetailScreen } from "@/product/ProductScreens";

export default function Page({ params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = use(params);
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandAgreementDetailScreen agreementId={agreementId} />}
    </AuthGate>
  );
}
