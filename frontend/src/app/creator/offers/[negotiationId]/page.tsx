"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { NegotiationDetail } from "@/features/dashboard/NegotiationDetail";

export default function Page({ params }: { params: Promise<{ negotiationId: string }> }) {
  const { negotiationId } = use(params);
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {() => <NegotiationDetail role="creator" negotiationId={negotiationId} />}
    </AuthGate>
  );
}
