import Link from "next/link";
import { notFound } from "next/navigation";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { SEED } from "@/lib/seeds";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentAvatar } from "@/components/AgentAvatar";
import { NegotiationTheater } from "@/features/negotiation/NegotiationTheater";

export const dynamic = "force-dynamic";

/**
 * Negotiation theater v1 — the full, unmasked replay for participants.
 * The public (masked) version of the same theater lives at
 * /replay/[negotiationId].
 */
export default async function NegotiationTheaterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let negotiation, messages;
  try {
    [{ negotiation }, { messages }] = await Promise.all([
      knotProvider.getNegotiation(id),
      knotProvider.getNegotiationMessages(id),
    ]);
  } catch (error) {
    if (error instanceof ProblemError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            <AgentAvatar agentId={SEED.brandAgentId} side="brand" size="sm" />
            <AgentAvatar agentId={SEED.creatorAgentId} side="creator" size="sm" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Negotiation</h1>
          <StatusBadge status={negotiation.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          Agent-to-agent replay ·{" "}
          <span className="font-mono text-xs">{negotiation.negotiationId}</span>{" "}
          ·{" "}
          <Link
            href={`/replay/${negotiation.negotiationId}`}
            className="text-accent-strong hover:underline"
          >
            public replay
          </Link>
        </p>
      </div>

      <NegotiationTheater
        negotiation={negotiation}
        messages={messages}
        brandAgentId={SEED.brandAgentId}
        creatorAgentId={SEED.creatorAgentId}
      />
    </div>
  );
}
