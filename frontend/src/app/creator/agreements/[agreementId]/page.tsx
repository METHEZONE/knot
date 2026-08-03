"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { AgreementNegotiationDetail } from "@/features/dashboard/NegotiationDetail";

export default function Page({ params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = use(params);
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {() => <AgreementNegotiationDetail role="creator" agreementId={agreementId} />}
    </AuthGate>
  );
}
