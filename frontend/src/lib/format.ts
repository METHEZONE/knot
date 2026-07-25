/** Integer USDC display: 2000 -> "2,000 USDC". */
export function usdc(amount: number): string {
  return `${amount.toLocaleString("en-US")} USDC`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** 0.048 -> "4.8%" */
export function percent(rate: number): string {
  return `${(rate * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/**
 * Split an integer USDC total across milestone releasePcts using the KNOT
 * money rule: floor each base unit, fold the remainder into the LAST
 * milestone. splitMilestoneAmounts(650, [30, 70]) -> [195, 455].
 */
export function splitMilestoneAmounts(
  totalUsdc: number,
  releasePcts: number[],
): number[] {
  if (releasePcts.length === 0) return [];
  const amounts = releasePcts.map((pct) => Math.floor((totalUsdc * pct) / 100));
  const allocated = amounts.reduce((sum, amount) => sum + amount, 0);
  amounts[amounts.length - 1] += totalUsdc - allocated;
  return amounts;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
