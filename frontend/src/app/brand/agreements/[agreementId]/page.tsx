"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { AgreementNegotiationDetail } from "@/features/dashboard/NegotiationDetail";

export default function Page({ params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = use(params);
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <AgreementNegotiationDetail role="brand" agreementId={agreementId} />}
    </AuthGate>
  );
}
