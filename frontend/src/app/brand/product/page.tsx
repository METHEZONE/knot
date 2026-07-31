"use client";

import { AuthGate } from "@/auth/AuthGate";
import { BrandProduct } from "@/features/onboard/BrandProduct";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND">
      {() => <BrandProduct />}
    </AuthGate>
  );
}
