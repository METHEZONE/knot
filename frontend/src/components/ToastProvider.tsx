"use client";

/**
 * Minimal toast system. `pushProblem` renders RFC 7807 errors:
 * problem.code as the title, detail as body, violations as field — rule rows.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProblemError } from "@/lib/api/client";

type ToastTone = "negative" | "positive" | "neutral";

interface ToastViolation {
  field: string;
  rule: string;
}

interface Toast {
  id: number;
  title: string;
  body?: string;
  violations?: ToastViolation[];
  tone: ToastTone;
}

interface ToastApi {
  push(toast: Omit<Toast, "id">): void;
  /** Format an unknown error (ProblemError-aware) as a negative toast. */
  pushProblem(error: unknown, fallbackTitle?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_CLS: Record<ToastTone, string> = {
  negative: "border-negative/40",
  positive: "border-positive/40",
  neutral: "border-border-subtle",
};

const TITLE_CLS: Record<ToastTone, string> = {
  negative: "text-negative",
  positive: "text-positive",
  neutral: "text-foreground",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => dismiss(id), 8000);
    },
    [dismiss],
  );

  const pushProblem = useCallback(
    (error: unknown, fallbackTitle = "Request failed") => {
      if (error instanceof ProblemError) {
        push({
          title: error.code,
          body: error.detail,
          violations: error.violations,
          tone: "negative",
        });
      } else {
        push({
          title: fallbackTitle,
          body: error instanceof Error ? error.message : String(error),
          tone: "negative",
        });
      }
    },
    [push],
  );

  const api = useMemo(() => ({ push, pushProblem }), [push, pushProblem]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto sketch-alt ink border bg-surface-raised p-3 shadow-lg shadow-black/40 ${TONE_CLS[toast.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`font-mono text-xs font-semibold tracking-wide ${TITLE_CLS[toast.tone]}`}
              >
                {toast.title}
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="text-muted transition-colors hover:text-foreground"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {toast.body && (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {toast.body}
              </p>
            )}
            {toast.violations && toast.violations.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {toast.violations.map((v, i) => (
                  <li
                    key={`${v.field}-${i}`}
                    className="rounded bg-negative/10 px-2 py-1 font-mono text-[10px] text-negative"
                  >
                    {v.field} — {v.rule}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
