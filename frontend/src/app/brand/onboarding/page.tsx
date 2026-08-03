import { AuthGate } from "@/auth/AuthGate";
import { BrandOnboardingScreen } from "@/product/ProductScreens";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" completedRedirect="/brand">
      {() => <BrandOnboardingScreen />}
    </AuthGate>
  );
}
