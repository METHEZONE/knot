import Link from "next/link";
import { notFound } from "next/navigation";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { SEED } from "@/lib/seeds";
import { usdc } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { TermSheetCard } from "@/features/negotiation/TermSheetCard";
import { EvidenceForm } from "@/features/evidence/EvidenceForm";

export const dynamic = "force-dynamic";

/** Creator-side deal page: agreed terms, escrow state, and the evidence flow. */
export default async function CreatorDealPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;

  let agreement;
  try {
    ({ agreement } = await knotProvider.getAgreement(agreementId));
  } catch (error) {
    if (error instanceof ProblemError && error.status === 404) notFound();
    throw error;
  }

  // No agreement->escrow lookup route yet; resolve via the seed escrow and
  // keep it only when it actually belongs to this agreement.
  const escrow = await knotProvider.getEscrow(SEED.escrowId).then(
    (r) => (r.escrow.agreementId === agreement.agreementId ? r.escrow : null),
    () => null,
  );

  const evidenceMilestoneId = agreement.terms.milestones.find(
    (m) => m.trigger === "EVIDENCE_VERIFIED",
  )?.id;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Deal</h1>
          <StatusBadge status={agreement.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          <span className="font-mono text-xs">{agreement.agreementId}</span>
          {agreementId === SEED.agreementId && (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/negotiations/${SEED.negotiationId}`}
                className="text-accent-strong hover:underline"
              >
                negotiation replay
              </Link>
            </>
          )}
        </p>
      </div>

      <TermSheetCard terms={agreement.terms} termsHash={agreement.termsHash} />

      {escrow && (
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Escrow</h2>
            <StatusBadge status={escrow.status} />
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {escrow.milestones.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sketch-alt ink border border-border-subtle bg-surface-raised px-3.5 py-2.5 text-sm"
              >
                <span className="font-mono text-xs uppercase tracking-wide text-accent-strong">
                  {m.id} · {m.trigger}
                </span>
                <span
                  className={`font-mono text-xs ${m.released ? "text-positive" : "text-muted"}`}
                >
                  {usdc(m.amountUsdc)} {m.released ? "released" : "held"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            {usdc(escrow.amountUsdc)} locked · fee {usdc(escrow.feeUsdc)} ·{" "}
            {escrow.receipt.status === "SIMULATED"
              ? "receipt simulated (no on-chain signature)"
              : "receipt confirmed on-chain"}
          </p>
        </section>
      )}

      <EvidenceForm
        agreementId={agreement.agreementId}
        submittedByAgentId={SEED.creatorAgentId}
        milestoneId={evidenceMilestoneId}
      />
    </div>
  );
}
