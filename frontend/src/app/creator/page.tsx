"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorDashboardScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {(context) => <CreatorDashboardScreen context={context} />}
    </AuthGate>
  );
}
