"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorSettlementScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {() => <CreatorSettlementScreen />}
    </AuthGate>
  );
}
