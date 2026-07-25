const TONE: Record<string, string> = {
  ACTIVE: "text-positive border-positive/30 bg-positive/10",
  AGREED: "text-positive border-positive/30 bg-positive/10",
  PASSED: "text-positive border-positive/30 bg-positive/10",
  RELEASED: "text-positive border-positive/30 bg-positive/10",
  LOCKED: "text-accent-strong border-accent/30 bg-accent/10",
  COMPLETED: "text-accent-strong border-accent/30 bg-accent/10",
  MATCHING: "text-accent-strong border-accent/30 bg-accent/10",
  IN_FLIGHT: "text-accent-strong border-accent/30 bg-accent/10",
  SIMULATED: "text-caution border-caution/30 bg-caution/10",
  PENDING: "text-caution border-caution/30 bg-caution/10",
  NEGOTIATING: "text-caution border-caution/30 bg-caution/10",
  COUNTERED: "text-caution border-caution/30 bg-caution/10",
  PARTIALLY_RELEASED: "text-caution border-caution/30 bg-caution/10",
  ESCALATED: "text-caution border-caution/30 bg-caution/10",
  DRAFT: "text-muted border-border-subtle bg-surface",
  FAILED: "text-negative border-negative/30 bg-negative/10",
  REJECTED: "text-negative border-negative/30 bg-negative/10",
  CANCELLED: "text-negative border-negative/30 bg-negative/10",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status] ?? "text-muted border-border-subtle bg-surface";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}
