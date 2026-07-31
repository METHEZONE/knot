"use client";

import { AuthGate } from "@/auth/AuthGate";
import { AgentDashboard } from "@/features/dashboard/AgentDashboard";

export default function Page() {
  return (
    <AuthGate expectedRole="BRAND" requireCompleted>
      {(context) => <AgentDashboard role="brand" context={context} />}
    </AuthGate>
  );
}
