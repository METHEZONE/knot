"use client";

import type { ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const v = {
    primary:
      "bg-[var(--k-ink)] text-white hover:bg-black active:scale-[0.98] shadow-[0_1px_2px_rgba(0,0,0,0.18)]",
    outline:
      "border border-[var(--k-line-strong)] bg-white text-[var(--k-ink)] hover:border-[var(--k-ink)] active:scale-[0.98]",
    ghost: "text-[var(--k-ink-soft)] hover:bg-black/[0.05]",
  }[variant];
  const s = {
    sm: "h-8 px-3 text-[13px] rounded-lg",
    md: "h-10 px-4 text-[14px] rounded-xl",
    lg: "h-12 px-6 text-[15px] rounded-xl",
  }[size];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-all duration-150 disabled:opacity-40 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "money" | "ink";
  className?: string;
}) {
  const t = {
    neutral: "bg-black/[0.05] text-[var(--k-ink-soft)]",
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-600",
    money: "bg-emerald-50 text-[var(--k-money)]",
    ink: "bg-[var(--k-ink)] text-white",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${t} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--k-muted)]">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "money";
}) {
  return (
    <div className="k-card flex-1 px-4 py-3.5">
      <div className="text-[12px] font-medium text-[var(--k-muted)]">{label}</div>
      <div
        className={`k-mono mt-0.5 text-[22px] font-bold leading-tight ${tone === "money" ? "text-[var(--k-money)]" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-[var(--k-muted)]">{sub}</div>}
    </div>
  );
}

export function LiveDot({ color = "#0d8a5f" }: { color?: string }) {
  return (
    <span
      className="k-live-dot inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  );
}

export function usdc(n: number) {
  return `${n.toLocaleString()} USDC`;
}
