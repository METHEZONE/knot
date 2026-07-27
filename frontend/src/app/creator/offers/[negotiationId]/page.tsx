"use client";

import { use } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { CreatorOfferDetailScreen } from "@/product/ProductScreens";

export default function Page({ params }: { params: Promise<{ negotiationId: string }> }) {
  const { negotiationId } = use(params);
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {() => <CreatorOfferDetailScreen negotiationId={negotiationId} />}
    </AuthGate>
  );
}
