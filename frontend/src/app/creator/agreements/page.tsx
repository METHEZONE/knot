"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorAgreementListScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {() => <CreatorAgreementListScreen />}
    </AuthGate>
  );
}
