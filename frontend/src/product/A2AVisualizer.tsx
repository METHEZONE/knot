"use client";

import { useMemo, useState } from "react";
import {
  mapTaskStateToCreatorStatus,
  taskStateMessage,
  type NegotiationEvent,
} from "./mvp";

export function A2ANegotiationVisualizer({
  events,
  emptyText = "아직 표시할 A2A 이벤트가 없습니다.",
  demoMode = false,
}: {
  events: NegotiationEvent[];
  emptyText?: string;
  demoMode?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(events.at(-1)?.id ?? null);
  const selected = events.find((event) => event.id === selectedId) ?? events.at(-1) ?? null;
  const latest = events.at(-1);
  const replayEvents = useMemo(() => events.slice(-6), [events]);

  return (
    <div className="rounded border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">A2A negotiation</p>
          <h3 className="mt-1 text-2xl font-semibold">Agent 간 협상 경로</h3>
        </div>
        {demoMode && <span className="rounded-full border border-border-subtle px-3 py-1 text-xs font-semibold text-muted">demo fixture</span>}
      </div>

      {events.length ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-[0.8fr_1.2fr_0.8fr] md:items-center">
            <AgentNode label="Brand Agent" agentId={latest?.senderType === "BRAND_AGENT" ? latest.senderAgentId : latest?.receiverAgentId} />
            <div className="relative min-h-28 rounded border border-dashed border-border-subtle bg-background p-4">
              <div className="absolute left-6 right-6 top-1/2 h-px border-t-2 border-dashed border-border-subtle" />
              <div className="relative flex min-h-20 items-center justify-between gap-2">
                {replayEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className={[
                      "sketch-pill border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold transition",
                      selected?.id === event.id ? "scale-105 bg-accent text-background" : "hover:-translate-y-0.5",
                      index === replayEvents.length - 1 ? "motion-safe:animate-pulse" : "",
                    ].join(" ")}
                  >
                    {event.messageType}
                  </button>
                ))}
              </div>
            </div>
            <AgentNode label="Creator Agent" agentId={latest?.senderType === "CREATOR_AGENT" ? latest.senderAgentId : latest?.receiverAgentId} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded border border-border-subtle bg-background p-4">
              <TaskStateBadge state={selected?.taskState ?? "TASK_STATE_SUBMITTED"} />
              <p className="mt-3 text-sm leading-6 text-muted">{taskStateMessage(selected?.taskState)}</p>
              {selected && (
                <p className="mt-2 text-sm font-semibold">
                  {mapTaskStateToCreatorStatus(selected.taskState, selected.messageType)}
                </p>
              )}
            </div>
            <NegotiationEventTimeline events={events} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </div>

          {selected && <NegotiationMessageDrawer event={selected} />}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">{emptyText}</p>
      )}
    </div>
  );
}

function AgentNode({ label, agentId }: { label: string; agentId?: string }) {
  return (
    <div className="sketch border-2 border-border-subtle bg-background p-4 text-center">
      <p className="text-lg font-semibold">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-muted">{agentId ?? "agent pending"}</p>
    </div>
  );
}

export function TaskStateBadge({ state }: { state: string }) {
  const tone = state.includes("COMPLETED")
    ? "text-positive"
    : state.includes("FAILED") || state.includes("REJECTED") || state.includes("CANCELED")
      ? "text-negative"
      : state.includes("AUTH")
        ? "text-caution"
        : "text-foreground";
  return <span className={`font-mono text-xs font-semibold ${tone}`}>{state}</span>;
}

function NegotiationEventTimeline({
  events,
  selectedId,
  onSelect,
}: {
  events: NegotiationEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {events.map((event, index) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onSelect(event.id)}
          className={[
            "rounded border p-3 text-left text-sm",
            selectedId === event.id ? "border-accent bg-surface-raised" : "border-border-subtle bg-background",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{index + 1}. {event.senderType === "BRAND_AGENT" ? "Brand Agent" : "Creator Agent"} · {event.messageType}</span>
            <span className="font-mono text-[11px] text-muted">{event.createdAt}</span>
          </div>
          {event.rationale && <p className="mt-1 line-clamp-2 text-muted">{event.rationale}</p>}
        </button>
      ))}
    </div>
  );
}

function NegotiationMessageDrawer({ event }: { event: NegotiationEvent }) {
  const [rawOpen, setRawOpen] = useState(false);
  return (
    <div className="mt-5 rounded border border-border-subtle bg-background p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="Message" value={event.messageType} />
        <Info label="Round" value={String(event.round)} />
        <Info label="Task" value={event.taskId} />
      </div>
      {event.rationale && <p className="mt-4 text-sm leading-6 text-muted">{event.rationale}</p>}
      <button type="button" onClick={() => setRawOpen((open) => !open)} className="mt-4 text-sm font-semibold underline">
        {rawOpen ? "raw structured payload 닫기" : "raw structured payload 보기"}
      </button>
      {rawOpen && (
        <pre className="mt-3 max-h-72 overflow-auto rounded border border-border-subtle bg-surface p-3 text-xs">
          {JSON.stringify(event.raw ?? event.terms ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase text-muted">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold">{value}</p>
    </div>
  );
}
