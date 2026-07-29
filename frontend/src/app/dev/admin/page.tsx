"use client";

import { useEffect, useState } from "react";
import { ProductApiClient, type ApiDevAdminOverview } from "@/product/apiClient";

export default function Page() {
  const [overview, setOverview] = useState<ApiDevAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    new ProductApiClient()
      .getDevAdminOverview()
      .then(setOverview)
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-8">
      <div>
        <p className="font-mono text-xs uppercase text-muted">Dev admin</p>
        <h1 className="mt-1 text-4xl">운영자 상태 확인</h1>
      </div>
      {error ? <Panel text={error} /> : null}
      {!overview && !error ? <Panel text="Product API dev-admin 상태를 불러오는 중..." /> : null}
      {overview ? (
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Enabled" value={String(overview.enabled)} />
            <Stat label="Actor" value={overview.actorUid} />
            <Stat label="Failures" value={String(overview.latestFailures.length)} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(overview.counts).map(([label, value]) => (
              <Stat key={label} label={label} value={String(value)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Panel({ text: value }: { text: string }) {
  return <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">{value}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 break-words font-mono text-sm">{value}</div>
    </div>
  );
}
