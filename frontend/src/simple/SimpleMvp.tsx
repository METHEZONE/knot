"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { AgentCharacter } from "@/components/AgentCharacter";
import { agreedTerms, brandFlow, creatorFlow, type Role } from "./flow";

const creatorBlockedTopics = [
  "도박",
  "고위험 금융",
  "다이어트 과장",
  "주류",
  "성인",
  "정치",
  "의료 효능",
  "경쟁 브랜드",
];

const creatorPreferredContent = [
  "Instagram Reels",
  "TikTok Short",
  "YouTube Shorts",
  "제품 리뷰",
  "언박싱",
  "스토리 링크",
  "라이브 클립",
  "UGC 컷다운",
];

const brandBlockedTerms = [
  "무기한 사용권",
  "과장 효능 표현",
  "경쟁사 동시 노출",
  "무검수 게시",
  "정산 전 원본 제공",
];

const brandDeliverables = [
  "Instagram Reel 1개",
  "Story 2개",
  "TikTok 1개",
  "YouTube Shorts 1개",
  "제품 언박싱",
  "사용 후기",
];

const matchedCreators = [
  {
    name: "Mina Studio",
    fit: "94%",
    publicRate: "Public range: 800-1,100 USDC",
    category: "wellness",
    reason: "브랜드 톤, 타깃 연령, 최근 콘텐츠 성과가 맞습니다.",
  },
  {
    name: "Noah Eats",
    fit: "81%",
    publicRate: "Public range: 1,000-1,400 USDC",
    category: "food",
    reason: "콘텐츠 품질은 좋지만 제품 카테고리 적합도는 낮습니다.",
  },
  {
    name: "Daily Rina",
    fit: "76%",
    publicRate: "Public range: 650-900 USDC",
    category: "beauty",
    reason: "가격대는 맞지만 일정 가능성이 낮습니다.",
  },
];

export function SimpleLanding() {
  return (
    <div className="flex flex-col gap-14 py-8 md:py-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>KNOT MVP</Tag>
            <Tag>A2A agent deal flow</Tag>
          </div>
          <div>
            <p className="text-lg font-semibold text-muted">
              지금까지의 협업은 이랬어요
            </p>
            <h1 className="mt-3 max-w-4xl text-5xl font-semibold leading-[0.95] md:text-7xl">
              브랜드는 DM을 50개 보내고, 답장은 3개 받아요.
            </h1>
            <div className="mt-6 max-w-2xl space-y-2 text-xl leading-relaxed text-foreground">
              <p>크리에이터는 제안을 놓치고, 단가는 눈치게임,</p>
              <p>정산은 엑셀과 계좌이체로 끝나죠.</p>
            </div>
            <p className="mt-6 max-w-2xl text-2xl font-semibold leading-relaxed">
              크리에이터랑 브랜드, 에이전트끼리 만나서 매듭 짓는 곳
            </p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              당신이 자는 동안, 당신의 에이전트가 딜을 협상하고 · 계약하고 · 정산합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryLink href="/brand/onboarding">브랜드로 시작</PrimaryLink>
            <SecondaryLink href="/creator/onboarding">크리에이터로 시작</SecondaryLink>
          </div>
        </div>

        <Panel>
          <AgentDealScene />
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["온보딩", "URL/문서 분석 후 사람은 최소 정책만 정합니다."],
          ["Agent 실행", "제안, 매칭, 협상은 에이전트끼리 A2A Task로 진행합니다."],
          ["진행 상태", "사용자는 진행중이에요! 수준의 상태만 봅니다."],
          ["결과 확인", "최종 금액, 콘텐츠, 권리, 마감만 확인합니다."],
          ["정산", "협상된 거래만 마일스톤/정산으로 넘어갑니다."],
        ].map(([label, body], index) => (
          <Panel key={label}>
            <div className="font-mono text-xs text-muted">0{index + 1}</div>
            <h2 className="mt-2 text-2xl font-semibold">{label}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}

export function CreatorOnboarding() {
  const [analyzed, setAnalyzed] = useState(false);
  return (
    <FlowPage
      role="creator"
      step="/creator/onboarding"
      title="크리에이터 온보딩"
      body="SNS를 분석하고, 내 에이전트가 제안을 걸러낼 최소 정책만 정합니다."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <StepLabel number="1" label="SNS URL 분석" />
          <Input label="SNS URL" placeholder="https://instagram.com/..." />
          <button className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background" onClick={() => setAnalyzed(true)}>
            내 에이전트에게 분석 맡기기
          </button>
          {analyzed && <AgentWorkingResult text="Creator Agent가 공개 프로필만 분석했습니다. 비공개 단가 정책은 분석 결과에 섞지 않습니다." />}
        </Panel>
        <Panel>
          <StepLabel number="2" label="제안 필터" />
          <Input label="제안받을 최소 금액" placeholder="750 USDC" />
          <ChoiceGroup label="받지 않을 주제" options={creatorBlockedTopics} defaultSelected={["도박", "고위험 금융", "다이어트 과장"]} />
          <ChoiceGroup label="선호 콘텐츠" options={creatorPreferredContent} defaultSelected={["Instagram Reels", "제품 리뷰", "스토리 링크"]} />
          <PrivacyNote>
            이 기준은 Creator Agent만 사용합니다. 브랜드 화면에는 최소 금액과 차단 주제가 그대로 노출되지 않습니다.
          </PrivacyNote>
          <PrimaryLink href="/creator/offers">Agent Inbox 열기</PrimaryLink>
        </Panel>
      </div>
    </FlowPage>
  );
}

export function CreatorOffers() {
  return (
    <FlowPage
      role="creator"
      step="/creator/offers"
      title="제안받기"
      body="브랜드가 직접 보낸 제안이 아니라, Brand Agent가 A2A로 보낸 제안을 Creator Agent가 먼저 검토합니다."
    >
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr]">
        <AgentWorkingPanel
          role="creator"
          title="진행중이에요!"
          body="Creator Agent가 새 제안을 읽고, 차단 주제와 최소 조건을 비공개로 대조하고 있습니다."
        />
        <Panel>
          <Tag>Agent filtered offer</Tag>
          <h2 className="mt-3 text-3xl font-semibold">Glow Bar Summer Kit</h2>
          <p className="mt-2 text-muted">
            공개 가능한 제안 요약만 표시합니다. 브랜드의 내부 최대 한도와 협상 전략은 보이지 않습니다.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniStat label="visible offer" value="800 USDC" />
            <MiniStat label="fit" value="92%" />
            <MiniStat label="agent action" value="counter" />
          </div>
          <SanitizedList
            items={[
              "카테고리와 콘텐츠 형식이 내 선호 조건과 맞습니다.",
              "차단 주제에는 걸리지 않았습니다.",
              "Creator Agent가 더 좋은 조건으로 counter를 준비했습니다.",
            ]}
          />
          <div className="mt-6">
            <PrimaryLink href="/creator/negotiate">A2A 협상 보기</PrimaryLink>
          </div>
        </Panel>
      </div>
    </FlowPage>
  );
}

export function BrandOnboarding() {
  const [analyzed, setAnalyzed] = useState(false);
  return (
    <FlowPage
      role="brand"
      step="/brand/onboarding"
      title="브랜드 온보딩"
      body="제품 문서나 PDF를 분석하고, Brand Agent가 움직일 제안서와 가격 한도만 정합니다."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <StepLabel number="1" label="제품 문서 분석" />
          <label className="block text-sm font-semibold">PDF 또는 제품 문서</label>
          <input className="mt-2 w-full rounded border border-border-subtle bg-background p-3 text-sm" type="file" accept=".pdf,.txt,.md,.doc,.docx" />
          <Input label="제품 URL" placeholder="https://brand.com/product" />
          <button className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background" onClick={() => setAnalyzed(true)}>
            Brand Agent에게 분석 맡기기
          </button>
          {analyzed && <AgentWorkingResult text="Brand Agent가 제품 요약, 타깃, 금지 표현 후보를 만들었습니다. 결제 권한은 아직 부여되지 않았습니다." />}
        </Panel>
        <Panel>
          <StepLabel number="2" label="제안서 정책" />
          <Input label="프로모션 이름" placeholder="Glow Bar Summer Kit" />
          <Input label="최대 협상 금액" placeholder="1000 USDC" />
          <ChoiceGroup label="원하는 콘텐츠" options={brandDeliverables} defaultSelected={["Instagram Reel 1개", "Story 2개", "제품 리뷰"]} />
          <ChoiceGroup label="받지 않을 조건" options={brandBlockedTerms} defaultSelected={["무기한 사용권", "과장 효능 표현"]} />
          <PrivacyNote>
            최대 협상 금액과 금지 조건은 Brand Agent의 private policy입니다. 크리에이터에게는 최종 제안 조건만 공개됩니다.
          </PrivacyNote>
          <PrimaryLink href="/brand/matching">Agent 매칭 시작</PrimaryLink>
        </Panel>
      </div>
    </FlowPage>
  );
}

export function BrandMatching() {
  return (
    <FlowPage
      role="brand"
      step="/brand/matching"
      title="크리에이터 매칭"
      body="Brand Agent가 공개 프로필과 사용 가능한 공개 rate range만 보고 후보를 좁힙니다."
    >
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr]">
        <AgentWorkingPanel
          role="brand"
          title="진행중이에요!"
          body="Brand Agent가 후보를 찾고, Creator Agent에게 A2A availability check를 요청하고 있습니다."
        />
        <div className="grid gap-4">
          {matchedCreators.map((creator, index) => (
            <Panel key={creator.name}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AgentCharacter agentId={`creator-${index}`} side="creator" category={creator.category} pose="idle" size={70} />
                  <div>
                    <h2 className="text-2xl font-semibold">{creator.name}</h2>
                    <p className="font-mono text-sm text-muted">{creator.fit} fit · {creator.publicRate}</p>
                  </div>
                </div>
                {index === 0 && <Tag>selected</Tag>}
              </div>
              <p className="mt-4 text-sm text-muted">{creator.reason}</p>
              <PrivacyNote>
                Creator의 minimum acceptable rate, blocked topics, private preference는 표시하지 않습니다.
              </PrivacyNote>
              {index === 0 && <div className="mt-5"><PrimaryLink href="/brand/negotiate">A2A 협상 시작</PrimaryLink></div>}
            </Panel>
          ))}
        </div>
      </div>
    </FlowPage>
  );
}

export function Negotiation({ role }: { role: Role }) {
  const next = role === "brand" ? "/brand/result" : "/creator/result";
  return (
    <FlowPage
      role={role}
      step={`/${role}/negotiate`}
      title="협상하기"
      body="협상은 Agent-to-Agent로 진행됩니다. 사용자는 진행 상태와 최종 결과만 확인합니다."
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1fr]">
        <A2AStatus role={role} />
        <Panel>
          <Tag>Negotiated result</Tag>
          <h2 className="mt-3 text-3xl font-semibold">합의 가능 조건을 찾았습니다.</h2>
          <p className="mt-2 text-muted">
            아래는 공개 가능한 최종 조건입니다. 상대의 private policy, 내부 한도, 거절 기준, scoring detail은 숨깁니다.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {agreedTerms.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </div>
          <div className="mt-6">
            <PrimaryLink href={next}>결과 확인</PrimaryLink>
          </div>
        </Panel>
      </div>
    </FlowPage>
  );
}

export function Result({ role }: { role: Role }) {
  const next = role === "brand" ? "/brand/settlement" : "/creator/milestones";
  return (
    <FlowPage role={role} step={`/${role}/result`} title="결과페이지" body="협상이 된 경우에만 계약 조건과 다음 실행 단계가 열립니다.">
      <Panel>
        <Tag>Agreed by agents</Tag>
        <h2 className="mt-3 text-4xl font-semibold">딜이 성사됐습니다.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {agreedTerms.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </div>
        <div className="mt-6 rounded border border-border-subtle bg-background p-4">
          <div className="font-mono text-xs text-muted">visible proof</div>
          <div className="mt-1 break-all font-mono text-sm">termsHash: sha256:7f1d-demo-agreement-terms</div>
          <p className="mt-2 text-sm text-muted">
            내부 협상 로그 전문과 양측 private policy는 결과페이지에 노출하지 않습니다.
          </p>
        </div>
        <div className="mt-6">
          <PrimaryLink href={next}>{role === "brand" ? "정산으로 이동" : "마일스톤 보기"}</PrimaryLink>
        </div>
      </Panel>
    </FlowPage>
  );
}

export function CreatorMilestones() {
  return (
    <FlowPage role="creator" step="/creator/milestones" title="마일스톤 페이지" body="Creator는 제출할 증빙과 받을 금액만 확인합니다.">
      <MilestoneList perspective="creator" />
    </FlowPage>
  );
}

export function BrandSettlement() {
  return (
    <FlowPage role="brand" step="/brand/settlement" title="정산" body="Brand는 협상된 거래에 대해서만 escrow lock과 release 상태를 확인합니다.">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
        <Panel>
          <MiniStat label="Deal Escrow" value="950 USDC" />
          <MiniStat label="Escrow lock tx" value="devnet ready" />
          <MiniStat label="Release tx" value="pending evidence" />
          <PrivacyNote>
            pay.sh API 비용과 creator 보수 escrow는 다른 결제 흐름입니다. 이 화면은 creator 보수 정산만 표시합니다.
          </PrivacyNote>
        </Panel>
        <MilestoneList perspective="brand" />
      </div>
    </FlowPage>
  );
}

function AgentDealScene() {
  return (
    <div className="relative min-h-[380px] overflow-hidden rounded border border-border-subtle bg-background">
      <div className="absolute left-6 top-6">
        <div className="font-mono text-xs uppercase text-muted">A2A task</div>
        <div className="mt-1 text-3xl font-semibold">진행중이에요!</div>
      </div>
      <div className="absolute left-[9%] top-[32%] text-center">
        <AgentCharacter agentId="creator-agent-demo" side="creator" category="wellness" pose="greet" size={118} />
        <div className="mt-2 text-sm font-semibold">Creator Agent</div>
      </div>
      <div className="absolute right-[9%] top-[32%] text-center">
        <AgentCharacter agentId="brand-agent-demo" side="brand" category="wellness" pose="greet" size={118} />
        <div className="mt-2 text-sm font-semibold">Brand Agent</div>
      </div>
      <svg viewBox="0 0 220 90" className="absolute left-1/2 top-[43%] h-28 w-56 -translate-x-1/2 squig-slow" aria-hidden="true">
        <path d="M5 46 C42 40 62 14 94 33 C125 53 89 82 69 58 C47 32 105 21 215 43" fill="none" stroke="var(--border)" strokeLinecap="round" strokeWidth="4" />
      </svg>
      <div className="absolute bottom-6 left-6 right-6 grid gap-2 sm:grid-cols-3">
        <MiniStat label="A2A" value="running" />
        <MiniStat label="visible" value="result only" />
        <MiniStat label="private" value="hidden" />
      </div>
    </div>
  );
}

function AgentWorkingPanel({ role, title, body }: { role: Role; title: string; body: string }) {
  return (
    <Panel>
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <div className="relative">
          <div className="absolute -inset-5 rounded-full border border-border-subtle opacity-40 animate-ping" />
          <AgentCharacter
            agentId={`${role}-working-agent`}
            side={role}
            category="wellness"
            pose="walk"
            size={132}
          />
        </div>
        <h2 className="mt-5 text-4xl font-semibold">{title}</h2>
        <p className="mt-3 max-w-md text-muted">{body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Tag>A2A Task</Tag>
          <Tag>private policy hidden</Tag>
          <Tag>result visible</Tag>
        </div>
      </div>
    </Panel>
  );
}

function A2AStatus({ role }: { role: Role }) {
  const viewer = role === "brand" ? "Brand" : "Creator";
  const other = role === "brand" ? "Creator" : "Brand";
  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Tag>A2A negotiation</Tag>
          <h2 className="mt-3 text-3xl font-semibold">진행중이에요!</h2>
          <p className="mt-2 text-muted">
            {viewer} Agent와 {other} Agent가 조건을 맞추고 있습니다.
          </p>
        </div>
        <AgentCharacter agentId={`${role}-negotiating`} side={role} category="wellness" pose="greet" size={90} />
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["1", "A2A Task opened", "양측 agent endpoint가 연결됐습니다."],
          ["2", "Offer exchanged", "공개 가능한 offer summary만 저장합니다."],
          ["3", "Counter evaluated", "private policy check는 화면에 노출하지 않습니다."],
          ["4", "Agreement artifact ready", "최종 조건과 termsHash만 사용자에게 보여줍니다."],
        ].map(([index, label, detail]) => (
          <div key={index} className="grid gap-3 rounded border border-border-subtle bg-background p-3 md:grid-cols-[32px_1fr]">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent font-mono text-xs text-background">{index}</div>
            <div>
              <div className="font-semibold">{label}</div>
              <p className="text-sm text-muted">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FlowPage({
  role,
  step,
  title,
  body,
  children,
}: {
  role: Role;
  step: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const flow = role === "creator" ? creatorFlow : brandFlow;
  return (
    <div className="flex flex-col gap-7 py-8">
      <div>
        <Tag>{role === "creator" ? "Creator Agent MVP" : "Brand Agent MVP"}</Tag>
        <h1 className="mt-3 text-5xl font-semibold leading-none">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted">{body}</p>
      </div>
      <nav className="grid gap-2 md:grid-cols-5" aria-label={`${role} flow`}>
        {flow.map(([label, href], index) => (
          <Link
            key={href}
            href={href}
            className={`rounded border p-3 text-center text-sm ${
              href === step
                ? "border-accent bg-accent text-background"
                : "border-border-subtle bg-surface hover:bg-surface-raised"
            }`}
          >
            <span className="font-mono text-xs">0{index + 1}</span>
            <span className="ml-2 font-semibold">{label}</span>
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  defaultSelected,
}: {
  label: string;
  options: string[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState(defaultSelected);
  return (
    <div className="mt-5">
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                setSelected((values) =>
                  active ? values.filter((value) => value !== option) : [...values, option],
                )
              }
              className={`rounded-full border px-3 py-1.5 text-sm ${
                active
                  ? "border-accent bg-accent text-background"
                  : "border-border-subtle bg-background text-foreground"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="sketch ink border border-border-subtle bg-surface p-5">{children}</section>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="sketch-pill ink inline-flex border border-border-subtle bg-surface-raised px-3 py-1 font-mono text-xs uppercase text-muted">{children}</span>;
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90">{children}</Link>;
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex rounded-full border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-raised">{children}</Link>;
}

function Input({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold">{label}</span>
      <input className="mt-2 w-full rounded border border-border-subtle bg-background p-3 text-sm outline-none focus:border-accent" placeholder={placeholder} />
    </label>
  );
}

function StepLabel({ number, label }: { number: string; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent font-mono text-xs text-background">{number}</span>
      <h2 className="text-3xl font-semibold">{label}</h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-surface px-3 py-2">
      <div className="font-mono text-[11px] uppercase text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-background p-3">
      <div className="font-mono text-[11px] uppercase text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded border border-caution/40 bg-caution/10 p-3 text-sm text-muted">
      {children}
    </div>
  );
}

function SanitizedList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2 text-sm text-muted">
      {items.map((item) => (
        <li key={item} className="rounded border border-border-subtle bg-background p-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

function AgentWorkingResult({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded border border-positive/40 bg-positive/10 p-3 text-sm">
      {text}
    </div>
  );
}

function MilestoneList({ perspective }: { perspective: Role }) {
  const milestones = [
    ["1", "계약 확정", "285 USDC", "완료"],
    ["2", "콘텐츠 제출", "475 USDC", "대기"],
    ["3", "증빙 확인 후 릴리즈", "190 USDC", "대기"],
  ] as const;
  return (
    <Panel>
      <h2 className="text-3xl font-semibold">Milestones</h2>
      <p className="mt-2 text-sm text-muted">
        {perspective === "creator"
          ? "Creator에게는 제출할 일과 받을 금액만 보입니다."
          : "Brand에게는 escrow 상태와 release 조건만 보입니다."}
      </p>
      <div className="mt-4 space-y-3">
        {milestones.map(([index, title, amount, status]) => (
          <div key={index} className="grid gap-3 rounded border border-border-subtle bg-background p-4 md:grid-cols-[40px_1fr_120px_80px]">
            <div className="font-mono text-muted">#{index}</div>
            <div className="font-semibold">{title}</div>
            <div className="font-mono">{amount}</div>
            <div className={status === "완료" ? "text-positive" : "text-muted"}>{status}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
