"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { BrandNegotiationDetailScreen } from "@/product/ProductScreens";

export default function Page({ params }: { params: Promise<{ negotiationId: string }> }) {
  const { negotiationId } = use(params);
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {() => <BrandNegotiationDetailScreen negotiationId={negotiationId} />}
    </AuthGate>
  );
}
