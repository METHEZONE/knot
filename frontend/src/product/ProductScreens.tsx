"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentCharacter } from "@/components/AgentCharacter";
import { brandWorkspaceRoutes, creatorWorkspaceRoutes } from "./flow";
import { ROLE_ENTRY, ROLE_LABEL, signIn } from "./session";
import type {
  AgentTask,
  BrandProduct,
  CreatorCriteria,
  CreatorDeal,
  DevOverview,
  Milestone,
  NegotiationView,
  Role,
  RoleSession,
  Settlement,
} from "./types";

type WorkspacePage =
  | "onboarding"
  | "product"
  | "criteria"
  | "negotiation"
  | "result"
  | "settlement"
  | "me"
  | "settings";

export function LandingScreen() {
  return (
    <div className="flex flex-col gap-14 py-8 md:py-14">
      <section className="grid min-h-[68vh] items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>KNOT</Pill>
            <Pill>Agent-to-Agent commerce</Pill>
          </div>
          <div>
            <p className="text-lg font-semibold text-muted">지금까지의 협업은 이랬어요</p>
            <h1 className="mt-3 max-w-4xl text-5xl font-semibold leading-[0.95] md:text-7xl">
              브랜드는 DM을 50개 보내고, 답장은 3개 받아요.
            </h1>
            <div className="mt-6 max-w-2xl space-y-2 text-xl leading-relaxed">
              <p>크리에이터는 제안을 놓치고, 단가는 눈치게임,</p>
              <p>정산은 엑셀과 계좌이체로 끝나죠.</p>
            </div>
            <p className="mt-6 max-w-2xl text-2xl font-semibold leading-relaxed">
              크리에이터랑 브랜드, 에이전트끼리 만나서 매듭 짓는 곳
            </p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              당신이 자는 동안, 당신의 에이전트가 딜을 협상하고, 계약하고, 정산합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryLink href="/login">로그인</PrimaryLink>
            <SecondaryLink href="/signup">회원가입</SecondaryLink>
            <SecondaryLink href="/dev/admin">Dev admin</SecondaryLink>
          </div>
        </div>

        <Panel>
          <AgentRelayScene />
        </Panel>
      </section>
    </div>
  );
}

export function LoginScreen() {
  return (
    <AuthFrame
      eyebrow="Sign in"
      title="어느 쪽으로 로그인할까요?"
      body="로그인은 이 창에만 적용됩니다. 창을 두 개 띄워 한쪽은 브랜드로, 다른 쪽은 크리에이터로 로그인하면 두 사용자가 서로 협상하는 걸 나란히 볼 수 있어요."
    >
      <Panel>
        <div className="grid gap-4">
          <Input label="Email" placeholder="you@company.com" type="email" />
          <Input label="Password" placeholder="Password" type="password" />
          <button
            type="button"
            disabled
            className="rounded-full border border-border-subtle bg-surface-raised px-5 py-3 text-sm font-semibold text-muted"
          >
            이메일 로그인 · 준비 중
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-border-subtle bg-surface-raised px-5 py-3 text-sm font-semibold text-muted"
          >
            Continue with Google · Coming soon
          </button>
        </div>
        <p className="mt-5 text-sm text-muted">
          이메일·구글·솔라나 지갑 로그인은 이후에 붙습니다. 지금은 아래에서 역할을
          골라 들어가세요. 계정을 새로 만들려면{" "}
          <Link className="font-semibold text-foreground" href="/signup">회원가입</Link>.
        </p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <RoleSignInCard
          role="brand"
          title="브랜드로 로그인"
          body="제품 제안서를 올리고, Brand Agent가 크리에이터를 찾아 협상합니다."
        />
        <RoleSignInCard
          role="creator"
          title="크리에이터로 로그인"
          body="협상 기준만 정해두면, Creator Agent가 들어온 제안을 선별합니다."
        />
      </div>
    </AuthFrame>
  );
}

export function SignupScreen() {
  return (
    <AuthFrame
      eyebrow="Create account"
      title="역할을 선택하세요"
      body="회원가입은 역할 선택 후 온보딩으로 이어지고, 온보딩 결과로 Brand 또는 Creator 프로필이 생성됩니다."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <RoleChoiceCard
          role="brand"
          title="브랜드로 시작"
          body="브랜드 정보와 제품 제안서를 만들고, Brand Agent가 크리에이터를 찾아 협상합니다."
          href="/signup/brand"
        />
        <RoleChoiceCard
          role="creator"
          title="크리에이터로 시작"
          body="SNS URL을 분석하고 협상 기준을 정하면, Creator Agent가 제안을 선별합니다."
          href="/signup/creator"
        />
      </div>
    </AuthFrame>
  );
}

export function RoleSignupScreen({ role, session }: { role: Role; session: RoleSession }) {
  const router = useRouter();
  const nextHref = ROLE_ENTRY[role];
  return (
    <AuthFrame
      eyebrow={`${role} signup`}
      title={`${session.organizationLabel} 프로필 생성`}
      body="지금 화면은 프로덕트 플로우 검증용 mock form입니다. 저장 인터페이스는 이후 Firestore profile document로 연결합니다."
    >
      <Panel>
        <div className="flex items-center gap-4">
          <AgentCharacter agentId={session.agentId} side={role} category="wellness" pose="greet" size={82} />
          <div>
            <Pill>{session.agentLabel}</Pill>
            <h2 className="mt-2 text-3xl font-semibold">기본 계정 정보</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Name" placeholder={session.userLabel} />
          <Input label={role === "brand" ? "Company" : "Creator name"} placeholder={session.organizationLabel} />
          <Input label="Email" placeholder="you@knot.demo" type="email" />
          <Input label="Workspace handle" placeholder={role === "brand" ? "glow-bar-labs" : "mina-studio"} />
        </div>
        <div className="mt-6">
          <PrimaryAction
            onClick={() => {
              signIn(role);
              router.push(nextHref);
            }}
          >
            온보딩 계속
          </PrimaryAction>
        </div>
      </Panel>
    </AuthFrame>
  );
}

export function BrandOnboardingScreen({ session }: { session: RoleSession }) {
  const [analyzed, setAnalyzed] = useState(false);
  return (
    <WorkspaceShell role="brand" active="onboarding" title="브랜드 온보딩" session={session}>
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <SectionTitle eyebrow="Brand source" title="브랜드 정보를 추가합니다" />
          <Input label="Brand website URL" placeholder="https://glowbar.example" />
          <Input label="Brand name" placeholder="Glow Bar Labs" />
          <Input label="Category" placeholder="wellness skincare" />
          <TextArea label="Target audience" placeholder="25-34, clean beauty, daily routine focused" />
          <button
            type="button"
            onClick={() => setAnalyzed(true)}
            className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            Agent에게 분석 맡기기
          </button>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Profile draft" title={analyzed ? "분석 결과" : "분석 대기"} />
          {analyzed ? (
            <div className="space-y-3">
              <InfoBox label="Brand summary" value={session.profileSummary} />
              <InfoBox label="Tone" value="신뢰감 있고 일상적인 제품 경험 중심" />
              <InfoBox label="Restricted claims" value="의료 효능 과장, 무검수 게시, 무기한 사용권 제외" />
            </div>
          ) : (
            <EmptyState text="URL과 기본 정보를 입력하면 공개 정보 기반 draft를 생성합니다." />
          )}
          <div className="mt-6">
            <PrimaryLink href="/brand/products/new">제품 추가로 이동</PrimaryLink>
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function BrandProductScreen({ product }: { product: BrandProduct }) {
  return (
    <WorkspaceShell role="brand" active="product" title="제품 추가" session={null}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Panel>
          <SectionTitle eyebrow="Promotion input" title="협찬할 제품 내용을 추가합니다" />
          <Input label="Product document" placeholder="PDF 또는 제품 설명 파일 업로드 예정" />
          <Input label="Product name" placeholder={product.title} />
          <Input label="Product URL" placeholder="https://glowbar.example/summer-kit" />
          <TextArea label="Objective" placeholder="여름 스킨케어 루틴 인지도와 스토리 링크 전환" />
          <TextArea label="Deliverables" placeholder={product.deliverables.join(", ")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Total budget (USDC)" placeholder={String(product.budgetUsdc)} />
            <Input label="Maximum offer (USDC)" placeholder={String(product.maxOfferUsdc)} />
          </div>
          <ChoiceGroup label="제외 조건" options={["무기한 사용권", "과장 효능 표현", "무검수 게시", "가격 미공개"]} defaultSelected={product.blockedTerms} />
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Agent handoff" title="Brand Agent가 사용할 공개 조건" />
          <div className="space-y-3">
            <InfoBox label="Product" value={product.title} />
            <InfoBox label="Target audience" value={product.targetAudience} />
            <InfoBox label="Max public offer" value={`${product.maxOfferUsdc} USDC`} />
          </div>
          <PrivacyNote>
            내부 hard cap, 정책 score, 승인 기준은 Creator Agent에게 공개하지 않습니다. A2A 메시지는 공개 가능한 offer/counter terms만 전달합니다.
          </PrivacyNote>
          <div className="mt-6">
            <PrimaryLink href="/brand/negotiate">크리에이터 매칭 및 협상 시작</PrimaryLink>
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function BrandNegotiationScreen({ view, product }: { view: NegotiationView; product: BrandProduct }) {
  return (
    <WorkspaceShell role="brand" active="negotiation" title="크리에이터 매칭 · 협상" session={null}>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <SectionTitle eyebrow="Matching" title="Agent가 후보를 찾고 있습니다" />
          <div className="mt-4 grid gap-3">
            <CandidateCard name="Mina Studio" score="94" reason="웰니스 뷰티 루틴 적합도 높음" selected />
            <CandidateCard name="Nari Daily" score="87" reason="UGC 전환 데이터 양호" />
            <CandidateCard name="Studio Sol" score="73" reason="일정 충돌 가능성" />
          </div>
        </Panel>
        <AgentNegotiationPanel view={view} nextHref="/brand/result" />
      </div>
      <Panel>
        <SectionTitle eyebrow="Promotion" title={product.title} />
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Budget" value={`${product.budgetUsdc} USDC`} />
          <InfoBox label="Max offer" value={`${product.maxOfferUsdc} USDC`} />
          <InfoBox label="Status" value={product.status} />
          <InfoBox label="A2A task" value={view.taskId} />
        </div>
      </Panel>
    </WorkspaceShell>
  );
}

export function BrandResultScreen({ view }: { view: NegotiationView }) {
  return (
    <WorkspaceShell role="brand" active="result" title="협상 결과" session={null}>
      <AgreementPanel view={view} />
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Panel>
          <SectionTitle eyebrow="Result" title="Mina Studio와 합의됐습니다" />
          <p className="text-muted">
            Brand Agent와 Creator Agent가 A2A Task를 완료했고, Agreement Artifact에 공개 가능한 합의 조건과 termsHash만 저장했습니다.
          </p>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Next" title="정산 준비" />
          <p className="text-muted">
            실제 지급은 LLM 판단이 아니라 deterministic policy check와 web3 gateway 승인 뒤 Solana Devnet escrow로 진행됩니다.
          </p>
          <div className="mt-5">
            <PrimaryLink href="/brand/settlement">정산 페이지로 이동</PrimaryLink>
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function BrandSettlementScreen({ settlement, milestones }: { settlement: Settlement; milestones: Milestone[] }) {
  return (
    <WorkspaceShell role="brand" active="settlement" title="정산" session={null}>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <SettlementPanel settlement={settlement} />
        <MilestonePanel milestones={milestones} mode="brand" />
      </div>
    </WorkspaceShell>
  );
}

export function CreatorOnboardingScreen({ session }: { session: RoleSession }) {
  const [analyzed, setAnalyzed] = useState(false);
  return (
    <WorkspaceShell role="creator" active="onboarding" title="크리에이터 온보딩" session={session}>
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <SectionTitle eyebrow="SNS source" title="내 SNS를 분석합니다" />
          <Input label="Instagram / TikTok / YouTube URL" placeholder="https://instagram.com/mina.studio" />
          <button
            type="button"
            onClick={() => setAnalyzed(true)}
            className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            Creator Agent에게 분석 맡기기
          </button>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Public profile" title={analyzed ? "분석 결과" : "분석 대기"} />
          {analyzed ? (
            <div className="space-y-3">
              <InfoBox label="Creator summary" value={session.profileSummary} />
              <InfoBox label="Content style" value="일상 루틴, 제품 리뷰, Reels 중심" />
              <InfoBox label="Past performance" value="스토리 링크 전환과 저장률이 높은 편" />
            </div>
          ) : (
            <EmptyState text="SNS URL을 입력하면 공개 프로필 draft를 생성합니다." />
          )}
          <div className="mt-6">
            <PrimaryLink href="/creator/criteria">협상 기준 추가</PrimaryLink>
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function CreatorCriteriaScreen({ criteria }: { criteria: CreatorCriteria }) {
  return (
    <WorkspaceShell role="creator" active="criteria" title="협상 기준 추가" session={null}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel>
          <SectionTitle eyebrow="Private criteria" title="Agent가 지킬 기준을 정합니다" />
          <Input label="Minimum amount (USDC)" placeholder={String(criteria.minimumUsdc)} />
          <ChoiceGroup
            label="받지 않을 주제"
            options={["담배", "도박", "고위험 금융", "의료 효능 과장", "정치 캠페인", "성인 콘텐츠", "환경오염 논란"]}
            defaultSelected={criteria.blockedDomains}
          />
          <ChoiceGroup
            label="선호 콘텐츠"
            options={["Instagram Reels", "제품 리뷰", "스토리 링크", "UGC 컷다운", "라이브 쇼핑", "롱폼 리뷰"]}
            defaultSelected={criteria.preferredContent}
          />
          <TextArea label="기타 기준" placeholder={criteria.notes} />
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Privacy boundary" title="비공개 기준은 노출하지 않습니다" />
          <p className="text-muted">
            Minimum, blocked domains, 개인 pricing preference는 Creator Agent 내부 판단에만 사용됩니다. Brand 화면에는 수락, counter, 거절 결과와 공개 가능한 이유만 표시됩니다.
          </p>
          <div className="mt-5 space-y-3">
            <InfoBox label="Usage rights" value={criteria.usageRights} />
            <InfoBox label="Agent action" value="Offer filter, counter, reject" />
          </div>
          <div className="mt-6">
            <PrimaryLink href="/creator/result">Agent 협상 결과 보기</PrimaryLink>
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function CreatorResultScreen({ deals }: { deals: CreatorDeal[] }) {
  return (
    <WorkspaceShell role="creator" active="result" title="협상 결과" session={null}>
      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <SectionTitle eyebrow="Agent summary" title="Creator Agent가 처리한 제안" />
          <p className="text-muted">
            각 브랜드와의 협상 결과만 보여줍니다. 브랜드의 내부 최대가, 평가 점수, A2A 메시지 전문은 공개하지 않습니다.
          </p>
          <div className="mt-5 grid gap-3">
            <InfoBox label="Negotiated" value={String(deals.length)} />
            <InfoBox label="Agreed" value={String(deals.filter((deal) => deal.status === "AGREED").length)} />
            <InfoBox label="Rejected by policy" value={String(deals.filter((deal) => deal.status === "REJECTED").length)} />
          </div>
        </Panel>
        <div className="grid gap-4">
          {deals.map((deal) => (
            <CreatorDealCard key={deal.brandId} deal={deal} />
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}

export function CreatorBrandDetailScreen({ deal }: { deal: CreatorDeal }) {
  return (
    <WorkspaceShell role="creator" active="result" title={deal.brandName} session={null}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel>
          <SectionTitle eyebrow="Brand deal" title={deal.productTitle} />
          <div className="space-y-3">
            <InfoBox label="Status" value={deal.status} />
            <InfoBox label="Result" value={deal.visibleResult} />
            <InfoBox label="Amount" value={`${deal.amountUsdc} USDC`} />
            <InfoBox label="termsHash" value={deal.termsHash ?? "not created"} />
          </div>
        </Panel>
        {deal.status === "AGREED" ? (
          <MilestonePanel milestones={deal.milestones} mode="creator" />
        ) : (
          <Panel>
            <SectionTitle eyebrow="No milestone" title="아직 수행할 작업이 없습니다" />
            <p className="text-muted">
              합의된 브랜드만 마일스톤과 정산 상태를 표시합니다.
            </p>
          </Panel>
        )}
      </div>
      {deal.status === "AGREED" && <SettlementPanel settlement={deal.settlement} />}
    </WorkspaceShell>
  );
}

export function RoleMeScreen({ role, session }: { role: Role; session: RoleSession }) {
  return (
    <WorkspaceShell role={role} active="me" title="마이페이지" session={session}>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center gap-4">
            <AgentCharacter agentId={session.agentId} side={role} category="wellness" pose="idle" size={92} />
            <div>
              <Pill>{role}</Pill>
              <h2 className="mt-2 text-3xl font-semibold">{session.organizationLabel}</h2>
            </div>
          </div>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Profile" title="프로필 요약" />
          <p className="text-muted">{session.profileSummary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <InfoBox label="User" value={session.userLabel} />
            <InfoBox label="Wallet" value={session.walletAddress} />
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function RoleSettingsScreen({ role, session }: { role: Role; session: RoleSession }) {
  return (
    <WorkspaceShell role={role} active="settings" title="설정" session={session}>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <SectionTitle eyebrow="Account" title="계정" />
          <Input label="Display name" placeholder={session.userLabel} />
          <Input label="Workspace" placeholder={session.organizationLabel} />
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Agent" title="에이전트" />
          <InfoBox label="Agent ID" value={session.agentId} />
          <InfoBox label="Mode" value="ACTIVE" />
          <PrivacyNote>Agent policy 변경은 audit event로 남기고, 결제 승인은 deterministic checks를 통과해야 합니다.</PrivacyNote>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Wallet" title="지갑" />
          <Input label="Wallet address" placeholder={session.walletAddress} />
          <InfoBox label="Network" value="Solana Devnet" />
        </Panel>
      </div>
    </WorkspaceShell>
  );
}

export function DevAdminScreen({ overview }: { overview: DevOverview }) {
  return (
    <div className="flex flex-col gap-7 py-8">
      <PageTitle
        eyebrow="Dev admin"
        title="운영자용 상태 확인"
        body="현재는 mock data source를 사용합니다. 같은 인터페이스에 Firestore/API data source를 붙이면 화면 코드는 유지됩니다."
      />
      <div className="grid gap-5 md:grid-cols-3">
        <InfoPanel label="Data mode" value={overview.dataMode} />
        <InfoPanel label="Active A2A tasks" value={String(overview.activeTaskCount)} />
        <InfoPanel label="Mock collections" value={String(overview.mockCollectionCount)} />
      </div>
      <Panel>
        <SectionTitle eyebrow="Routes" title="MVP app surface" />
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {[...brandWorkspaceRoutes, ...creatorWorkspaceRoutes].map((route) => (
            <Link key={route.href} href={route.href} className="rounded border border-border-subtle bg-background p-3 text-sm hover:bg-surface-raised">
              {route.href}
            </Link>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionTitle eyebrow="Events" title="System events" />
        <div className="mt-4 space-y-3">
          {overview.events.map((event) => (
            <div key={event.id} className="grid gap-3 rounded border border-border-subtle bg-background p-4 md:grid-cols-[80px_1fr_100px]">
              <span className="font-mono text-xs text-muted">{event.type}</span>
              <span>{event.label}</span>
              <span className="font-mono text-xs uppercase text-muted">{event.status}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AuthFrame({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7 py-10">
      <PageTitle eyebrow={eyebrow} title={title} body={body} />
      {children}
    </div>
  );
}

function WorkspaceShell({
  role,
  title,
  session,
  children,
}: {
  role: Role;
  active: WorkspacePage;
  title: string;
  session: RoleSession | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Pill>{role} workspace</Pill>
            <h1 className="mt-3 text-4xl font-semibold leading-none">{title}</h1>
            {session && <p className="mt-2 text-sm text-muted">{session.organizationLabel}</p>}
          </div>
          <nav aria-label={`${role} account actions`} className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link href={`/${role}/me`} className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-raised">
              My
            </Link>
            <Link href={`/${role}/settings`} className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-raised">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex min-w-0 flex-col gap-5">{children}</main>
    </div>
  );
}

function RoleChoiceCard({ role, title, body, href }: { role: Role; title: string; body: string; href: string }) {
  const router = useRouter();
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <AgentCharacter agentId={`${role}-signup-agent`} side={role} category="wellness" pose="greet" size={86} />
        <div>
          <Pill>{role}</Pill>
          <h2 className="mt-2 text-4xl font-semibold">{title}</h2>
        </div>
      </div>
      <p className="mt-4 text-muted">{body}</p>
      <div className="mt-6">
        <PrimaryAction
          onClick={() => {
            signIn(role);
            router.push(href);
          }}
        >
          선택
        </PrimaryAction>
      </div>
    </Panel>
  );
}

/**
 * 이 창을 해당 역할로 로그인시킨다. 세션은 창 단위(sessionStorage)라서, 창을
 * 두 개 띄워 한쪽은 브랜드로 한쪽은 크리에이터로 로그인하면 두 유저가 된다.
 */
function RoleSignInCard({ role, title, body }: { role: Role; title: string; body: string }) {
  const router = useRouter();
  const label = ROLE_LABEL[role];
  return (
    <button
      type="button"
      onClick={() => {
        signIn(role);
        router.push(ROLE_ENTRY[role]);
      }}
      className="sketch ink block w-full border border-border-subtle bg-surface p-5 text-left hover:bg-surface-raised"
    >
      <div className="flex items-center gap-3">
        <AgentCharacter agentId={`${role}-jump-agent`} side={role} category="wellness" pose="idle" size={64} />
        <div>
          <Pill>{label.org}</Pill>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{body}</p>
    </button>
  );
}

function AgentRelayScene() {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded border border-border-subtle bg-background">
      <div className="absolute left-6 top-6">
        <div className="font-mono text-xs uppercase text-muted">A2A task stream</div>
        <div className="mt-1 text-3xl font-semibold">협상 진행중</div>
      </div>
      <div className="absolute left-[7%] top-[34%] text-center">
        <AgentCharacter agentId="creator-relay-agent" side="creator" category="wellness" pose="greet" size={116} />
        <div className="mt-2 text-sm font-semibold">Creator Agent</div>
      </div>
      <div className="absolute right-[7%] top-[34%] text-center">
        <AgentCharacter agentId="brand-relay-agent" side="brand" category="wellness" pose="greet" size={116} />
        <div className="mt-2 text-sm font-semibold">Brand Agent</div>
      </div>
      <div className="absolute left-1/2 top-[48%] h-2 w-40 -translate-x-1/2 overflow-hidden rounded-full border border-border-subtle bg-surface">
        <div className="h-full w-2/3 animate-pulse bg-accent" />
      </div>
      <div className="absolute bottom-6 left-6 right-6 grid gap-2 sm:grid-cols-3">
        <InfoBox label="A2A" value="working" />
        <InfoBox label="Visible" value="progress + result" />
        <InfoBox label="Private" value="policy hidden" />
      </div>
    </div>
  );
}

function AgentNegotiationPanel({ view, nextHref }: { view: NegotiationView; nextHref: string }) {
  const [revealed, setRevealed] = useState(false);
  const progress = revealed ? 100 : view.progressPercent;
  return (
    <Panel>
      <AgentProgressCard
        role={view.role}
        title={revealed ? "협상이 완료됐습니다" : "진행중이에요!"}
        body={`${view.counterpartyAgentLabel}와 A2A Task로 조건을 맞추고 있습니다.`}
        progress={progress}
      />
      <div className="mt-6">
        <ProgressBar progress={progress} />
      </div>
      <div className="mt-5 grid gap-3">
        {view.tasks.map((task) => (
          <TaskRow key={task.id} task={task} forceDone={revealed} />
        ))}
      </div>
      <PrivacyNote>
        사용자에게는 진행 상태와 최종 결과만 보여줍니다. private policy, 상대의 hard cap, 내부 scoring, A2A 메시지 전문은 숨깁니다.
      </PrivacyNote>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          협상 완료 상태 보기
        </button>
        {revealed && <PrimaryLink href={nextHref}>결과 확인</PrimaryLink>}
      </div>
    </Panel>
  );
}

function AgreementPanel({ view }: { view: NegotiationView }) {
  return (
    <Panel>
      <SectionTitle eyebrow="Agreement artifact" title={view.title} />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {view.terms.map((term) => (
          <InfoBox key={term.label} label={term.label} value={term.value} />
        ))}
      </div>
      <div className="mt-5 rounded border border-border-subtle bg-background p-4">
        <div className="font-mono text-xs uppercase text-muted">termsHash</div>
        <div className="mt-1 break-all font-mono text-sm">{view.termsHash}</div>
      </div>
    </Panel>
  );
}

function SettlementPanel({ settlement }: { settlement: Settlement }) {
  return (
    <Panel>
      <SectionTitle eyebrow="Deal escrow" title="크리에이터 보수 정산" />
      <div className="grid gap-3 md:grid-cols-2">
        <InfoBox label="Escrow status" value={settlement.escrowStatus} />
        <InfoBox label="Locked" value={`${settlement.escrowAmountUsdc} USDC`} />
        <InfoBox label="Released" value={`${settlement.releasedUsdc} USDC`} />
        <InfoBox label="Pending" value={`${settlement.pendingUsdc} USDC`} />
      </div>
      <div className="mt-5 space-y-3">
        <TxBox label="Escrow lock transaction" value={settlement.lockTx} />
        <TxBox label="Escrow release transaction" value={settlement.releaseTx} />
      </div>
      <PrivacyNote>
        pay.sh API 비용과 Creator 보수 escrow는 분리됩니다. 이 화면은 deal escrow만 표시합니다.
      </PrivacyNote>
    </Panel>
  );
}

function MilestonePanel({ milestones, mode }: { milestones: Milestone[]; mode: "brand" | "creator" }) {
  return (
    <Panel>
      <SectionTitle eyebrow="Milestones" title={mode === "brand" ? "검증 및 지급 단계" : "수행할 작업"} />
      <div className="mt-4 space-y-3">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="rounded border border-border-subtle bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{milestone.title}</div>
                <div className="mt-1 text-sm text-muted">{mode === "creator" ? milestone.creatorAction : milestone.status}</div>
              </div>
              <span className="font-mono text-sm">{milestone.amountUsdc} USDC</span>
            </div>
            <div className="mt-3">
              <ProgressBar progress={milestone.progressPercent} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CandidateCard({ name, score, reason, selected = false }: { name: string; score: string; reason: string; selected?: boolean }) {
  return (
    <div className={`rounded border p-4 ${selected ? "border-positive bg-positive/10" : "border-border-subtle bg-background"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{name}</span>
        <span className="font-mono text-sm">score {score}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{reason}</p>
      {selected && <div className="mt-3 text-sm font-semibold text-positive">A2A negotiation opened</div>}
    </div>
  );
}

function CreatorDealCard({ deal }: { deal: CreatorDeal }) {
  const href = `/creator/brands/${deal.brandId}`;
  return (
    <Link href={href} className="sketch ink block border border-border-subtle bg-surface p-5 hover:bg-surface-raised">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Pill>{deal.status}</Pill>
          <h2 className="mt-2 text-3xl font-semibold">{deal.brandName}</h2>
          <p className="mt-1 text-muted">{deal.productTitle}</p>
        </div>
        <div className="font-mono text-xl">{deal.amountUsdc ? `${deal.amountUsdc} USDC` : "-"}</div>
      </div>
      <p className="mt-4 text-sm text-muted">{deal.visibleResult}</p>
    </Link>
  );
}

function AgentProgressCard({ role, title, body, progress }: { role: Role; title: string; body: string; progress: number }) {
  return (
    <div className="rounded border border-border-subtle bg-background p-5">
      <div className="flex items-center gap-5">
        <div className="relative">
          {progress < 100 && <div className="absolute -inset-4 animate-ping rounded-full border border-border-subtle opacity-40" />}
          <AgentCharacter agentId={`${role}-progress-agent`} side={role} category="wellness" pose={progress < 100 ? "walk" : "greet"} size={104} />
        </div>
        <div>
          <Pill>{progress < 100 ? "Working" : "Ready"}</Pill>
          <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted">{body}</p>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, forceDone }: { task: AgentTask; forceDone: boolean }) {
  const status = forceDone && task.status !== "queued" ? "done" : task.status;
  return (
    <div className="rounded border border-border-subtle bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">{task.label}</span>
        <span className="font-mono text-xs uppercase text-muted">{status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{task.visibleDetail}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-xs text-muted">
        <span>progress</span>
        <span>{progress}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-border-subtle bg-background">
        <div className="h-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function ChoiceGroup({ label, options, defaultSelected = [] }: { label: string; options: string[]; defaultSelected?: string[] }) {
  const [selected, setSelected] = useState(defaultSelected);
  const selectedText = useMemo(() => selected.join(", "), [selected]);
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
      <div className="mt-2 font-mono text-xs text-muted">selected: {selectedText || "none"}</div>
    </div>
  );
}

function PageTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <Pill>{eyebrow}</Pill>
      <h1 className="mt-3 text-5xl font-semibold leading-none">{title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{body}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <Pill>{eyebrow}</Pill>
      <h2 className="mt-3 text-3xl font-semibold leading-none">{title}</h2>
    </div>
  );
}

function Input({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold">{label}</span>
      <input type={type} className="mt-2 w-full rounded border border-border-subtle bg-background p-3 text-sm outline-none focus:border-accent" placeholder={placeholder} />
    </label>
  );
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold">{label}</span>
      <textarea rows={4} className="mt-2 w-full rounded border border-border-subtle bg-background p-3 text-sm outline-none focus:border-accent" placeholder={placeholder} />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded border border-border-subtle bg-background p-5 text-sm text-muted">{text}</div>;
}

function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded border border-caution/40 bg-caution/10 p-3 text-sm text-muted">
      {children}
    </div>
  );
}

function TxBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded border border-border-subtle bg-background p-3">
      <div className="font-mono text-[11px] uppercase text-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-sm">{value ?? "pending live devnet transaction"}</div>
    </div>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <div className="font-mono text-xs uppercase text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </Panel>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-background p-3">
      <div className="font-mono text-[11px] uppercase text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="sketch ink border border-border-subtle bg-surface p-5">{children}</section>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="sketch-pill ink inline-flex border border-border-subtle bg-surface-raised px-3 py-1 font-mono text-xs uppercase text-muted">{children}</span>;
}

function PrimaryAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90">
      {children}
    </button>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90">{children}</Link>;
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex rounded-full border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-raised">{children}</Link>;
}
