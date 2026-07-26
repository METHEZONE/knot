"use client";

import { AuthGate } from "@/auth/AuthGate";
import { CreatorOnboardingScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR" completedRedirect="/creator">
      {() => <CreatorOnboardingScreen />}
    </AuthGate>
  );
}
