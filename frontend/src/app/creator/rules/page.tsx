"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorRules } from "@/features/onboard/CreatorRules";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR">
      {() => <CreatorRules />}
    </AuthGate>
  );
}
