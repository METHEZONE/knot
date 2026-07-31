"use client";

import { AuthGate } from "@/auth/AuthGate";
import { AgentDashboard } from "@/features/dashboard/AgentDashboard";

export default function Page() {
  return (
    <AuthGate expectedRole="CREATOR" requireCompleted>
      {(context) => <AgentDashboard role="creator" context={context} />}
    </AuthGate>
  );
}
