"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandMood } from "@/features/onboard/BrandMood";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND">
      {() => <BrandMood />}
    </AuthGate>
  );
}
