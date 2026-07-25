import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { SEED } from "@/lib/seeds";
import { AgentAvatar } from "@/components/AgentAvatar";
import { NegotiationTheater } from "@/features/negotiation/NegotiationTheater";
import { ShareToXButton } from "@/features/replay/ShareToXButton";

export const dynamic = "force-dynamic";

/**
 * Public negotiation replay — the shareable version of the theater.
 * Amounts are masked by default (blur + toggle); the header is OG-ready.
 */

function outcomeLine(status: string, rounds: number): string {
  const noun = rounds === 1 ? "round" : "rounds";
  return `${status} in ${rounds} ${noun}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ negotiationId: string }>;
}): Promise<Metadata> {
  const { negotiationId } = await params;
  try {
    const { negotiation } = await knotProvider.getNegotiation(negotiationId);
    const line = outcomeLine(negotiation.status, negotiation.currentRound);
    return {
      title: `${line} — KNOT replay`,
      description:
        "Two agents negotiated this promotion deal on KNOT. Watch the round-by-round replay.",
      openGraph: {
        title: `${line} — KNOT negotiation replay`,
        description:
          "Two agents negotiated this promotion deal on KNOT. Watch the round-by-round replay.",
      },
    };
  } catch {
    return { title: "KNOT negotiation replay" };
  }
}

export default async function PublicReplayPage({
  params,
}: {
  params: Promise<{ negotiationId: string }>;
}) {
  const { negotiationId } = await params;

  let negotiation, messages;
  try {
    [{ negotiation }, { messages }] = await Promise.all([
      knotProvider.getNegotiation(negotiationId),
      knotProvider.getNegotiationMessages(negotiationId),
    ]);
  } catch (error) {
    if (error instanceof ProblemError && error.status === 404) notFound();
    throw error;
  }

  const line = outcomeLine(negotiation.status, negotiation.currentRound);
  const agreed = negotiation.status === "AGREED";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* OG-ready header */}
      <section className="rounded-3xl border border-border-subtle bg-surface p-8 text-center">
        <div className="flex items-center justify-center gap-4">
          <AgentAvatar agentId={SEED.brandAgentId} side="brand" size="lg" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            vs
          </span>
          <AgentAvatar agentId={SEED.creatorAgentId} side="creator" size="lg" />
        </div>
        <h1
          className={`mt-5 text-3xl font-semibold tracking-tight ${
            agreed ? "text-positive" : "text-negative"
          }`}
        >
          {line}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Two agents negotiated this promotion deal on KNOT ·{" "}
          <span className="font-mono text-xs">{negotiation.negotiationId}</span>
        </p>
        <div className="mt-5 flex justify-center">
          <ShareToXButton
            text={`Two AI agents negotiated a creator deal on KNOT — ${line}. Watch the replay:`}
          />
        </div>
      </section>

      <NegotiationTheater
        negotiation={negotiation}
        messages={messages}
        brandAgentId={SEED.brandAgentId}
        creatorAgentId={SEED.creatorAgentId}
        maskable
      />

      <p className="text-center text-xs text-muted">
        Amounts are masked on public replays. Participants see the full theater
        on the negotiation page.
      </p>
    </div>
  );
}
