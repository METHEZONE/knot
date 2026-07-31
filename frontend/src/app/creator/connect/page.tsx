"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorConnect } from "@/features/onboard/CreatorConnect";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR">
      {() => <CreatorConnect />}
    </AuthGate>
  );
}
