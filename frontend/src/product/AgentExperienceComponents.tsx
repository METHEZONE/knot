"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import type {
  AgentActivityActor,
  AgentActivityItem,
  AgentManagerView,
  AgreementEscrowView,
  NextActionView,
} from "./agentExperience";
import type { Role } from "./types";

export function AgentManagerCard({ manager }: { manager: AgentManagerView }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start gap-4">
        <AgentCharacter
          agentId={manager.agentId}
          side={manager.role}
          category="beauty"
          pose={manager.status === "ACTIVE" ? "greet" : "idle"}
          size={92}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sketch-pill border border-border-subtle bg-background px-2.5 py-1 font-mono text-[10px] uppercase text-muted">
              내 Manager
            </span>
            <span className="sketch-pill border border-border-subtle bg-surface-raised px-2.5 py-1 font-mono text-[10px] uppercase text-muted">
              {manager.status === "ACTIVE" ? "활성 상태" : "설정 필요"}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold">{manager.agentName}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ManagerFact label={manager.primaryLabel} value={manager.primaryValue} />
            <ManagerFact label={manager.secondaryLabel} value={manager.secondaryValue} />
          </div>
          <div className="mt-4 rounded border border-border-subtle bg-background p-3">
            <div className="font-mono text-[10px] uppercase text-muted">최근 업데이트</div>
            <p className="mt-1 text-sm leading-6 text-muted">{manager.recentUpdate}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={manager.settingsHref}
              className="sketch-pill bg-accent px-4 py-2 text-sm font-semibold text-background"
            >
              에이전트 설정
            </Link>
            <Link
              href={manager.activityHref}
              className="sketch-pill ink border border-border-subtle bg-surface-raised px-4 py-2 text-sm font-semibold text-muted"
            >
              전체 활동 보기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActionRequiredList({ items }: { items: NextActionView[] }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeading eyebrow="Next" title="확인이 필요한 일" />
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <NextActionCard key={`${item.label}-${index}`} action={item} />
          ))
        ) : (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            지금 바로 처리할 항목이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

export function AgentActivityPreview({
  activities,
  emptyText,
}: {
  activities: AgentActivityItem[];
  emptyText: string;
}) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeading eyebrow="Agent Activity" title="최근 Agent 활동" />
      <div className="mt-4 grid gap-3">
        {activities.length ? (
          activities.slice(0, 5).map((activity) => (
            <ActivityPreviewRow key={activity.id} activity={activity} />
          ))
        ) : (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

export function AgentConversationExperience({
  role,
  title,
  activities,
  sidebar,
  nextAction,
}: {
  role: Role;
  title: string;
  activities: AgentActivityItem[];
  sidebar: AgreementEscrowView;
  nextAction: NextActionView;
}) {
  const reduced = useReducedMotion();
  const status = activities.some((item) => item.status === "ACTIVE") ? "대화 진행 중" : "대화 완료";
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div className="sticky top-14 z-20 mb-4 border-b border-border-subtle bg-background/90 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <AgentCharacter
              agentId={`${role}-conversation-manager`}
              side={role}
              category="beauty"
              pose={status === "대화 진행 중" ? "walk" : "idle"}
              size={58}
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase text-muted">Agent conversation</p>
              <h2 className="text-3xl font-semibold leading-tight">{title}</h2>
              <p className="text-sm text-muted">{status}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="sketch-pill ink flex items-center justify-between border border-border-subtle bg-surface px-4 py-3">
            <span className="font-semibold">에이전트끼리 대화</span>
            <span className="font-mono text-xs uppercase text-muted">{status === "대화 완료" ? "완료" : "working"}</span>
          </div>
          {activities.map((activity, index) => (
            <ConversationMessage
              key={activity.id}
              activity={activity}
              align={alignmentFor(role, activity.actor)}
              animate={!reduced}
              index={index}
            />
          ))}
          <NextActionCard action={nextAction} prominent />
        </div>
      </section>
      <AgreementEscrowSidebar view={sidebar} role={role} />
    </div>
  );
}

export function AgreementEscrowSidebar({ view, role }: { view: AgreementEscrowView; role: Role }) {
  return (
    <aside className="grid h-fit gap-4 lg:sticky lg:top-20">
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeading eyebrow="Agreement" title="계약 요약" />
        <div className="mt-4 grid gap-3">
          <SidebarFact label="Agreement ID" value={view.agreementId ?? "생성 전"} />
          <SidebarFact label="Status" value={view.agreementStatus} />
          <SidebarFact label="Amount" value={view.amountUsdc === null ? "pending" : `${view.amountUsdc} USDC`} />
          <SidebarFact label="Deliverables" value={view.deliverables} />
          <SidebarFact label="Usage rights" value={view.usageRights} />
          <SidebarFact label="Deadline" value={view.deadline} />
          <SidebarFact label="Terms hash" value={view.termsHash ?? "pending"} mono />
        </div>
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeading eyebrow="Escrow" title="에스크로 상태" />
        <EscrowVault total={view.fundedAmountUsdc} released={view.releasedAmountUsdc} />
        <div className="mt-4 grid gap-3">
          <SidebarFact label="Network" value={view.network} />
          <SidebarFact label="Status" value={view.escrowStatus} />
          <SidebarFact label={role === "creator" ? "정산 가능" : "Release 가능"} value={`${view.availableAmountUsdc} USDC`} />
          <SidebarFact label="Signature" value={view.signature ?? "pending"} mono />
          {view.explorerUrl && (
            <Link href={view.explorerUrl} className="text-sm font-semibold underline" target="_blank" rel="noreferrer">
              Explorer 열기
            </Link>
          )}
        </div>
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeading eyebrow="Milestones" title="마일스톤" />
        <div className="mt-4 grid gap-3">
          {view.milestones.length ? (
            view.milestones.map((milestone) => (
              <div key={milestone.id} className="rounded border border-border-subtle bg-background p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{milestone.title}</span>
                  <span className="font-mono text-xs text-muted">{milestone.percentage}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
                  <span>{milestone.status}</span>
                  <span>{milestone.amountUsdc} USDC</span>
                </div>
                <ProgressLine progress={milestone.progressPercent} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Agreement 생성 후 표시됩니다.</p>
          )}
        </div>
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeading eyebrow="Authority" title="내 Agent 권한" />
        <p className="mt-3 text-sm leading-6 text-muted">
          {role === "creator"
            ? "내 기준선과 제외 카테고리만 내 화면에 표시합니다. Brand의 숨겨진 한도는 표시하지 않습니다."
            : "내 딜당 한도와 자동 승인 범위만 내 화면에 표시합니다. Creator의 숨겨진 기준값은 표시하지 않습니다."}
        </p>
      </section>
    </aside>
  );
}

function ActivityPreviewRow({ activity }: { activity: AgentActivityItem }) {
  const content = (
    <div className="rounded border border-border-subtle bg-background p-4 transition-colors hover:bg-surface-raised">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{activity.actorName}</span>
        <span className="font-mono text-[10px] uppercase text-muted">
          {activity.createdAt ? formatShortTime(activity.createdAt) : activity.status}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">{activity.message}</p>
    </div>
  );
  return activity.href ? <Link href={activity.href}>{content}</Link> : content;
}

function ConversationMessage({
  activity,
  align,
  animate,
  index,
}: {
  activity: AgentActivityItem;
  align: "left" | "right" | "center";
  animate: boolean;
  index: number;
}) {
  if (align === "center") {
    return (
      <motion.div
        initial={animate ? { opacity: 0, scale: 0.96 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: Math.min(index * 0.04, 0.2) }}
        className="sketch-pill self-center border-2 border-dashed border-border-subtle bg-surface-raised px-4 py-2 text-center text-sm"
      >
        <div className="font-semibold">{activity.title ?? activity.actorName}</div>
        <p className="mt-1 text-muted">{activity.message}</p>
        {activity.policyReason && <p className="mt-1 text-xs text-muted">{activity.policyReason}</p>}
      </motion.div>
    );
  }

  const side: Role = activity.actor === "BRAND_AGENT" ? "brand" : "creator";
  return (
    <motion.article
      initial={animate ? { opacity: 0, x: align === "right" ? 16 : -16 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className={`flex max-w-[96%] items-end gap-3 ${align === "right" ? "flex-row-reverse self-end" : "self-start"}`}
    >
      <AgentCharacter agentId={`${side}-${activity.actorName}`} side={side} category="beauty" pose="idle" size={58} />
      <div className={align === "right" ? "text-right" : ""}>
        <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-muted">
          <span>{activity.actorName}</span>
          {activity.terms?.amountUsdc && (
            <span className="sketch-pill border border-border-subtle bg-surface-raised px-2 py-0.5">
              {activity.terms.amountUsdc} USDC
            </span>
          )}
          <span>{activity.status}</span>
        </div>
        <div className="sketch-alt ink border border-border-subtle bg-surface px-4 py-3 text-[15px] leading-7">
          <p>{activity.message}</p>
          {activity.terms && (
            <div className="mt-3 grid gap-2 rounded border border-border-subtle bg-background p-3 text-xs text-muted sm:grid-cols-2">
              {activity.terms.deliverables && <span>{activity.terms.deliverables}</span>}
              {activity.terms.usageRights && <span>{activity.terms.usageRights}</span>}
              {activity.terms.deadline && <span>{activity.terms.deadline}</span>}
              {activity.terms.performancePct !== undefined && <span>성과 {activity.terms.performancePct}%</span>}
            </div>
          )}
          {activity.developerMeta && (
            <details className="mt-3 text-left text-xs text-muted">
              <summary className="cursor-pointer">developer details</summary>
              <dl className="mt-2 grid gap-1 font-mono">
                {activity.developerMeta.taskId && <MetaRow label="task" value={activity.developerMeta.taskId} />}
                {activity.developerMeta.contextId && <MetaRow label="context" value={activity.developerMeta.contextId} />}
                {activity.developerMeta.messageId && <MetaRow label="message" value={activity.developerMeta.messageId} />}
                {activity.developerMeta.artifactId && <MetaRow label="artifact" value={activity.developerMeta.artifactId} />}
              </dl>
            </details>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function NextActionCard({ action, prominent = false }: { action: NextActionView; prominent?: boolean }) {
  const body = (
    <div className={`${prominent ? "sketch ink" : "rounded"} border border-border-subtle bg-surface-raised p-4`}>
      <div className="font-mono text-[10px] uppercase text-muted">Next Action</div>
      <h3 className="mt-1 text-2xl font-semibold">{action.label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{action.message}</p>
    </div>
  );
  return action.href ? <Link href={action.href}>{body}</Link> : body;
}

function EscrowVault({ total, released }: { total: number; released: number }) {
  const pct = total > 0 ? Math.round((released / total) * 100) : 0;
  const rawClipId = useId();
  const clipId = `agent-escrow-${rawClipId.replace(/:/g, "")}`;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 90 100" width="76" height="84" className="squig" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d="M18 40 C6 54 8 88 45 92 C82 88 84 54 72 40 Z" />
          </clipPath>
        </defs>
        <path
          d="M18 40 C6 54 8 88 45 92 C82 88 84 54 72 40 Z"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y={100 - pct} width="90" height={pct} fill="var(--positive)" opacity="0.25" />
        </g>
        <path
          d="M22 40 C34 22 48 44 58 30 C66 20 76 36 74 40"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <div>
        <div className="text-xs text-muted">에스크로에 잠긴 금액</div>
        <div className="font-mono text-2xl">{total} USDC</div>
        <div className="mt-1 text-xs text-muted">{released > 0 ? `${pct}% 지급됨` : "아직 지급 전"}</div>
      </div>
    </div>
  );
}

function ManagerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function SidebarFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded border border-border-subtle bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 break-words text-sm ${mono ? "font-mono" : "font-semibold"}`}>{value}</div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{eyebrow}</p>
      <h2 className="mt-1 text-3xl font-semibold">{title}</h2>
    </div>
  );
}

function ProgressLine({ progress }: { progress: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full border border-border-subtle bg-surface">
      <div className="h-full bg-accent" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <dt>{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

function alignmentFor(role: Role, actor: AgentActivityActor): "left" | "right" | "center" {
  if (actor === "POLICY" || actor === "SYSTEM") return "center";
  if (role === "brand") return actor === "BRAND_AGENT" ? "right" : "left";
  return actor === "CREATOR_AGENT" ? "right" : "left";
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}
