/**
 * 라이브 데모 대본 — 등장인물, 대사, 타이밍 전부 여기서 결정된다.
 *
 * 원칙 (docs/24_UX_JOURNEY_v1.md 계승):
 *  - 금액·판정은 결정론. 대사는 그 값을 읽어 만든 문장. 둘이 어긋나면 버그.
 *  - 모든 에이전트 발화에는 reasoning(왜 이 판단인지)이 붙을 수 있고,
 *    한도(사람이 정한 숫자)가 결말을 가른다: 400 ≤ 450 체결, 800 > 450 차단.
 */

import type {
  BrandProfile,
  CampaignSpec,
  ChatChip,
  CreatorCard,
  DemoState,
  FeedTone,
  InboundOffer,
  SequenceStep,
  TaskBrief,
} from "./types";

let seq = 0;
export const nextId = () => `d${(seq += 1)}`;

/* ---------------------------------- 캐스트 --------------------------------- */

export const HERO_ID = "ssin";

export const CREATORS: CreatorCard[] = [
  {
    id: "ssin",
    handle: "@ssin",
    name: "ssin 씬기록",
    color: "#e8896b",
    photo: "/demo/ssin.jpg",
    followers: "100만",
    engagement: "5.8%",
    niche: "뷰티 크리에이터",
    fit: 94,
    fitReason: "뷰티 무드 정합 최상 · 평균 조회수 7만 · 전환형 시청층",
    profileUrl: "youtube.com/@ssin",
    insights: { avgViews: "7만", saves30d: "4,200", growth30d: "+2.8%", topFormat: "메이크업 튜토리얼" },
  },
  {
    id: "geekble",
    handle: "@geekble_kr",
    name: "긱블 Geekble",
    color: "#7ba05b",
    photo: "/demo/geekble.jpg",
    followers: "120만",
    engagement: "6.1%",
    niche: "테크 · 공학 콘텐츠",
    fit: 88,
    fitReason: "평균 조회수 28.6만 · CPM 효율 최상 · 제작 슬롯 여유",
    profileUrl: "youtube.com/@geekble_kr",
    insights: { avgViews: "28.6만", saves30d: "9,800", growth30d: "+4.6%", topFormat: "공학 실험 · 제작기" },
  },
  {
    id: "risabae",
    handle: "@RISABAE",
    name: "RISABAE",
    color: "#6b7fd7",
    photo: "/demo/risabae.jpg",
    followers: "268만",
    engagement: "3.4%",
    niche: "뷰티 프리미엄",
    fit: 76,
    fitReason: "구독 268만 메가 채널 · 평균 조회수 12만 · 단가 프리미엄 예상",
    profileUrl: "youtube.com/@RISABAE",
    insights: { avgViews: "12만", saves30d: "6,100", growth30d: "+0.9%", topFormat: "커버 메이크업" },
  },
];

export const creatorById = (id: string) =>
  CREATORS.find((c) => c.id === id) ?? CREATORS[0];

/** 오토파일럿이 자동 체결하는 캐스트 — 탐험 대상은 아니라 CREATORS 밖 */
export const AUTOPILOT_CREATOR = {
  id: "jocoding",
  handle: "@jocoding",
  name: "조코딩 JoCoding",
  color: "#b58cd9",
  photo: "/demo/jocoding.jpg",
  niche: "테크 · 코딩",
  fit: 82,
  amountUsdc: 220,
};

/** 크리에이터 창의 주인공(씬님)이 정해둔 규칙 — /c 화면에 항상 노출 */
export const HERO_RULES = {
  agentName: "루프",
  minUsdc: 400,
  weeklySlots: "주 1건",
  blocked: ["도박", "담배", "고금리 대출"],
  bonusAsk: "조회수 15만 초과 시 +10% 보너스 조항 요구",
};

/** 완주 리포트의 결정론 수치 — 대사·리포트 카드·챗 컨텍스트가 전부 이 값을 읽는다 */
export const REPORT_SUMMARY = {
  totalViews: "44.6만", // 씬님 18.2만 + 긱블 26.4만
  targetViews: "30만",
  totalSaves: "3,840", // 씬님 1,540 + 긱블 2,300
  cpmVsIndustry: "-27%",
  spentUsdc: 700, // 400 + 보너스 40 + 260
  budgetUsdc: 1000,
  savedPct: 30,
};

/** URL에서 "추출"되는 브랜드 프로필 — 데모 기본값은 무드빔 */
export function buildBrandProfile(url: string): BrandProfile {
  const domain = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const isDefault = /moodbeam|무드빔/i.test(domain) || domain.length === 0;
  const fallbackName = domain.split(".")[0] || "moodbeam";
  return {
    url: domain || "moodbeam.kr",
    name: isDefault
      ? "무드빔"
      : fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
    tagline: "방의 공기를 바꾸는 조명",
    intro:
      "방의 분위기를 바꾸는 조명을 만드는 팀입니다. 달빛과 노을을 모티프로, 1인 가구의 저녁 시간을 디자인합니다.",
    tone: ["따뜻한", "미니멀", "저녁의"],
    products: [
      { name: "문라이트 램프", desc: "달빛 색온도 재현 무드등" },
      { name: "선셋 프로젝터", desc: "노을 그라데이션 프로젝션" },
    ],
    audience: "1인 가구 · 인테리어 감성 20-34",
    images: [],
    color: "#d9a441",
    logo: "/demo/moodbeam.svg",
    agentName: "타래",
  };
}

/* --------------------------- 브랜드 기반 대사 헬퍼 --------------------------- */
/* 캠페인 플로우의 모든 브랜드 언급은 실제 스캔된 brand에서 만든다 — 고정 문구 금지. */

/** 브랜드 계정 핸들 — 도메인 첫 파트 (moodbeam.kr → @moodbeam) */
export const brandHandle = (brand: Pick<BrandProfile, "url"> | null | undefined) =>
  (brand?.url ?? "").split(".")[0] || "brand";

const brandName = (brand: BrandProfile | null) => brand?.name ?? "브랜드";
const agentName = (brand: BrandProfile | null) => brand?.agentName ?? "타래";
const productName = (brand: BrandProfile | null, i = 0) =>
  brand?.products[i]?.name ?? brand?.products[0]?.name ?? "신제품";

export const CAMPAIGN_SPEC: CampaignSpec = {
  goal: "신제품 런칭 붐업",
  contentType: "릴스 1개 (30초 내외)",
  budgetUsdc: 1000,
  maxPerDealUsdc: 450,
  deadlineLabel: "2주 안에",
};

export function taskBriefFor(brand: BrandProfile | null): TaskBrief {
  return {
    criteria: [
      "#광고 표기 필수 (게시물 상단)",
      "제품 실사용 컷 3초 이상",
      `@${brandHandle(brand)} 계정 태그`,
    ],
    tasks: [
      "릴스 1개 업로드 (30초 내외)",
      "업로드 후 게시물 URL 제출",
      "48시간 인사이트 공유 동의",
    ],
    references: [
      { title: `${productName(brand)} 첫인상 릴스`, length: "0:27", note: "전환 컷 리듬 참고" },
      { title: `${productName(brand, 1)} 실사용 브이로그`, length: "0:31", note: "실사용 연출 참고" },
      { title: "엔딩 CTA 훅 모음", length: "0:24", note: "마지막 3초 CTA 참고" },
    ],
  };
}

/* -------------------------------- 상태 헬퍼 -------------------------------- */

function feed(draft: DemoState, icon: string, text: string, tone: FeedTone = "info") {
  draft.feed.unshift({ id: nextId(), icon, text, tone, at: Date.now() });
  if (draft.feed.length > 40) draft.feed.pop();
}

function agentSays(draft: DemoState, text: string, chips?: ChatChip[]) {
  draft.agentTyping = false;
  draft.chat.push({ id: nextId(), role: "agent", text, chips, at: Date.now() });
}

function typing(draft: DemoState) {
  draft.agentTyping = true;
}

function a2a(
  draft: DemoState,
  creatorId: string,
  from: "brand" | "creator" | "policy",
  text: string,
  reasoning?: string,
  amountUsdc?: number | null,
) {
  const n = draft.campaign?.negotiations[creatorId];
  if (!n) return;
  n.status = "talking";
  n.messages.push({ id: nextId(), from, text, reasoning, amountUsdc });
}

function patchOffer(
  draft: DemoState,
  id: string,
  patch: Partial<Pick<InboundOffer, "status" | "amountUsdc" | "note">>,
) {
  const o = draft.inboundOffers.find((x) => x.id === id);
  if (o) Object.assign(o, patch);
}

const txHash = (label: string) => {
  let h = 0x811c9dc5;
  const s = `${label}:${seq}`;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${hex}…${hex.slice(0, 4)}`;
};

/* ------------------------------ 1. 온보딩 스캔 ------------------------------ */

export function scanSequence(url: string): SequenceStep[] {
  const steps: SequenceStep[] = [
    {
      d: 0,
      run: (draft) => {
        draft.stage = "scanning";
        draft.scan = { url, step: 0, done: false };
      },
    },
  ];
  for (let i = 1; i <= 4; i += 1) {
    steps.push({
      d: i === 1 ? 900 : 750,
      run: (draft) => {
        if (draft.scan) draft.scan.step = i;
      },
    });
  }
  // 피날레(브랜드 확정 + 부화)는 store.finishScan이 실제 스캔 결과 도착 시점에 처리한다.
  return steps;
}

export function enterWorkspaceSequence(): SequenceStep[] {
  return [
    {
      d: 0,
      run: (draft) => {
        draft.stage = "workspace";
        feed(draft, "🧶", `브랜드 에이전트 ${draft.brand?.agentName ?? "타래"} 생성 완료`, "ok");
      },
    },
    { d: 700, run: typing },
    {
      d: 1200,
      run: (draft) => {
        const b = draft.brand;
        const toneLine = b?.tone.length ? `${b.tone.slice(0, 3).join("·")} 톤, 마음에 들어요` : "브랜드 결이 마음에 들어요";
        const productLine = b?.products[0]?.name ? ` ${b.products[0].name}도 눈여겨봤고요.` : "";
        agentSays(
          draft,
          `안녕하세요, ${brandName(b)}의 에이전트 ${agentName(b)}예요. 사이트 다 읽었어요 — ${toneLine}.${productLine} 첫 캠페인 시작해볼까요?`,
          [{ id: "start-campaign", label: "새 캠페인 만들기" }],
        );
      },
    },
  ];
}

/* --------------------------- 2. 캠페인 생성 (칩 대화) --------------------------- */

export function composeFlowFor(brand: BrandProfile | null) {
  const product = productName(brand);
  return {
    goal: {
      question: "좋아요. 이번 캠페인 목표가 뭐예요?",
      chips: [
        { id: "goal-launch", label: `${product} 런칭 붐업` },
        { id: "goal-aware", label: "브랜드 인지도" },
        { id: "goal-conv", label: "전환 · 판매" },
      ],
    },
    budget: {
      question: `${product} 캠페인이군요. 예산은 어떻게 잡을까요? 딜당 한도는 제가 넘을 수 없는 선이에요 — 그 안에선 승인 없이 제가 알아서 체결해요.`,
      chips: [
        { id: "budget-500", label: "총 500 · 딜당 300" },
        { id: "budget-1000", label: "총 1,000 · 딜당 450" },
        { id: "budget-2000", label: "총 2,000 · 딜당 600" },
      ],
    },
    content: {
      question: "콘텐츠 형식은요?",
      chips: [
        { id: "content-reel", label: "릴스 1개" },
        { id: "content-reel-story", label: "릴스 + 스토리" },
        { id: "content-shorts", label: "유튜브 쇼츠" },
      ],
    },
    confirm: {
      question: `정리하면 — ${product} 런칭 · 총 1,000 USDC (딜당 450) · 릴스 1개 · 2주 안에. 이 조건으로 크리에이터 탐험 다녀올게요. 물어오는 딜은 승인만 해주시면 돼요.`,
      chips: [{ id: "launch-expedition", label: "🧭 탐험 보내기" }],
    },
  } as const;
}

/* ------------------------------- 3. 탐험 대본 ------------------------------- */

export function expeditionSequence(brand: BrandProfile | null): SequenceStep[] {
  const S: SequenceStep[] = [];
  const step = (d: number, run: SequenceStep["run"]) => S.push({ d, run });
  const bName = brandName(brand);
  const product = productName(brand);

  // -- 출발 + 스카우팅 --
  step(0, (draft) => {
    draft.composeStep = "done";
    draft.campaign = {
      spec: { ...CAMPAIGN_SPEC, goal: `${product} 런칭 붐업` },
      status: "scouting",
      discovered: [],
      negotiations: {},
      deals: [],
      brief: null,
      reportReady: false,
    };
    feed(draft, "🧭", "탐험 출발 — 크리에이터 네트워크 스캔 시작");
  });
  CREATORS.forEach((c, i) => {
    step(i === 0 ? 1400 : 1100, (draft) => {
      draft.campaign?.discovered.push(c.id);
      draft.campaign!.negotiations[c.id] = {
        creatorId: c.id,
        status: "queued",
        messages: [],
        agreedUsdc: null,
        blockedReason: null,
      };
      feed(draft, "✨", `${c.handle} 발견 — 적합도 ${c.fit}`, "info");
    });
  });
  step(1200, (draft) => {
    draft.campaign!.status = "negotiating";
    feed(draft, "🤝", "적합도 상위 3명과 A2A 협상 개시");
  });

  // -- 긱블: 스피드런 체결 (가격 맞으면 바로) --
  step(900, (draft) => {
    draft.campaign!.negotiations.geekble.status = "contacting";
  });
  step(900, (draft) =>
    a2a(
      draft,
      "geekble",
      "brand",
      `안녕하세요 긱블 에이전트님! ${bName} ${product} 런칭 릴스 1건, 260 USDC로 제안드려요.`,
      "긱블 평균 조회수 28.6만 — CPM 효율 최상 구간. 딜당 한도 450의 58%에서 시작.",
      260,
    ),
  );
  step(1700, (draft) =>
    a2a(
      draft,
      "geekble",
      "creator",
      `${product}, 직접 만져보고 보여줄 수 있는 아이템이라 긱블 결이랑 맞네요. 기준선 250 넘었고 제작 슬롯도 비어 있어요 — 가격 맞으면 바로 갑니다. 콜.`,
      "최소 단가 250 충족 + 카테고리 적합 → 즉시 수락.",
      260,
    ),
  );
  step(1400, (draft) => {
    a2a(draft, "geekble", "brand", "딜! 계약 아티팩트 만들게요 🧶", "260 ≤ 한도 450 → 사람 승인 없이 자율 체결.");
    draft.campaign!.negotiations.geekble.status = "agreed";
    draft.campaign!.negotiations.geekble.agreedUsdc = 260;
    feed(draft, "🪢", "@geekble_kr 체결 — 260 USDC (2라운드)", "ok");
  });

  // -- 씬님(주인공): 밀당 끝에 체결 --
  step(1100, (draft) => {
    draft.campaign!.negotiations.ssin.status = "contacting";
    draft.inboundOffers.unshift({
      id: "offer-moodbeam",
      brandName: draft.brand?.name ?? "무드빔",
      brandLogo: draft.brand?.logo ?? "/demo/moodbeam.svg",
      amountUsdc: 320,
      format: "릴스 1개 (30초 내외)",
      status: "new",
      note: "루프가 조건 확인 중",
      at: Date.now(),
    });
  });
  step(1000, (draft) => {
    a2a(
      draft,
      "ssin",
      "brand",
      `씬님 에이전트님 안녕하세요, ${bName}의 ${agentName(brand)}예요. ${product} 런칭 릴스, 320 USDC 어때요?`,
      "뷰티 무드 정합 최상(94) → 예산 여유분 우선 배정. 한도의 71%에서 시작.",
      320,
    );
    patchOffer(draft, "offer-moodbeam", { status: "negotiating", note: "루프가 협상 중" });
  });
  step(2000, (draft) =>
    a2a(
      draft,
      "ssin",
      "creator",
      "씬님은 구독 100만 뷰티 채널이에요. 평균 조회수 7만이지만 뷰티 시청층이라 저장·전환이 다르죠. 씬님이 정해둔 기준선은 400입니다 — 이 아래론 저도 못 내려가요.",
      "사람이 정한 최소 단가 400. 에이전트 권한으로도 내릴 수 없는 선.",
      400,
    ),
  );
  step(2100, (draft) =>
    a2a(
      draft,
      "ssin",
      "brand",
      "방금 전환 데이터 확인했어요 — 저장률이 카테고리 평균의 3배네요. 400이면 제 권한(딜당 450) 안이라 승인 없이 체결 가능해요. 콜.",
      "성과 데이터 검증 통과. 400 ≤ 450 → 자율 체결 가능.",
      400,
    ),
  );
  step(1900, (draft) =>
    a2a(
      draft,
      "ssin",
      "creator",
      "좋아요. 대신 성과 보너스 조항 하나만 — 조회수 15만(평균 7만의 2배) 넘으면 +40 어때요?",
      "기준 규칙: 평균 조회수 2배(15만) 초과 시 +10% 보너스 요구.",
      440,
    ),
  );
  step(1800, (draft) => {
    a2a(
      draft,
      "ssin",
      "brand",
      "합리적이네요. 보너스는 에스크로에 조건부로 걸어둘게요. 계약 묶습니다 🪢",
      "체결가 400 + 조건부 보너스 40 = 최대 440 ≤ 한도 450.",
      400,
    );
    draft.campaign!.negotiations.ssin.status = "agreed";
    draft.campaign!.negotiations.ssin.agreedUsdc = 400;
    patchOffer(draft, "offer-moodbeam", { status: "agreed", amountUsdc: 400, note: "400 + 보너스 조항 — 브랜드 승인 대기" });
    feed(draft, "🪢", "@ssin 체결 — 400 USDC + 보너스 조항 (4라운드)", "ok");
  });

  // -- 리사배: 한도 초과 → 정책 차단 (자율성의 경계) --
  step(1100, (draft) => {
    draft.campaign!.negotiations.risabae.status = "contacting";
  });
  step(1000, (draft) =>
    a2a(
      draft,
      "risabae",
      "brand",
      `RISABAE 팀 에이전트님, ${bName} ${product} 런칭 협업 제안드려요. 340 USDC부터 시작해볼까요?`,
      "구독 268만 메가 채널 → 프리미엄 단가 예상, 한도의 76%에서 높게 시작.",
      340,
    ),
  );
  step(1900, (draft) =>
    a2a(
      draft,
      "risabae",
      "creator",
      "리사배님 브랜드 협업 최소 단가는 800이에요. 268만 채널 기준이라 그 아래는 논의하지 않습니다.",
      "채널 정책: 800 미만 제안 자동 거절.",
      800,
    ),
  );
  step(1600, (draft) =>
    a2a(
      draft,
      "risabae",
      "policy",
      "정책 차단 — 요구액 800 USDC가 딜당 한도 450을 초과",
      "한도는 사람이 정한 숫자. 에이전트는 넘을 수 없고, 넘으려면 사람이 한도를 올려야 함.",
      800,
    ),
  );
  step(1700, (draft) => {
    a2a(
      draft,
      "risabae",
      "brand",
      "800은 제 권한 밖이라 이번 건은 접을게요. 다음 캠페인 예산에서 다시 인사드릴게요 🙇",
      "한도 초과 시 승인 요청 대신 철수 — 예산 보호가 기본 동작.",
      null,
    );
    draft.campaign!.negotiations.risabae.status = "blocked";
    draft.campaign!.negotiations.risabae.blockedReason = "딜당 한도 450 초과 (요구 800)";
    feed(draft, "🛡️", "@RISABAE 협상 종료 — 정책 한도 초과로 자율 철수", "warn");
  });

  // -- 귀환 보고 --
  step(1500, (draft) => {
    draft.campaign!.status = "pending_approval";
    feed(draft, "🎒", "탐험 귀환 — 딜 2건 확보, 승인 대기", "money");
  });
  step(600, typing);
  step(1300, (draft) => {
    agentSays(
      draft,
      "탐험 다녀왔어요! 3명 만나서 2건 물어왔습니다 — 씬님 400(+보너스 조항), 긱블 260. 합계 660 USDC로 예산의 66%예요. RISABAE는 800을 불러서 제 권한 밖이라 접었어요. 승인해주시면 에스크로 걸고 바로 시작합니다.",
    );
  });
  return S;
}

/* ---------------------------- 4. 승인 → 매듭 → 진행 ---------------------------- */

export function knotSequence(brand: BrandProfile | null): SequenceStep[] {
  const S: SequenceStep[] = [];
  const step = (d: number, run: SequenceStep["run"]) => S.push({ d, run });

  step(0, (draft) => {
    draft.campaign!.status = "knotting";
    feed(draft, "🪢", "승인 완료 — 에이전트 매듭 묶는 중", "ok");
  });
  step(2600, (draft) => {
    const c = draft.campaign!;
    c.status = "active";
    c.brief = taskBriefFor(brand);
    c.deals = [
      {
        creatorId: "ssin",
        amountUsdc: 400,
        termsHash: "sha256:9f2c41a8…b3",
        milestones: [
          { id: "m1", label: "계약 체결", pct: 30, usdc: 120, status: "active" },
          { id: "m2", label: "게시물 검증", pct: 70, usdc: 280, status: "locked" },
        ],
        starPct: 10,
        bonusUsdc: null,
        postUrl: null,
        awaitingPost: false,
        verify: null,
        metrics: null,
        txs: [{ label: "에스크로 예치 400 USDC", hash: txHash("lock-ssin") }],
      },
      {
        creatorId: "geekble",
        amountUsdc: 260,
        termsHash: "sha256:5d18ce02…7a",
        milestones: [
          { id: "m1", label: "계약 체결", pct: 30, usdc: 78, status: "active" },
          { id: "m2", label: "게시물 검증", pct: 70, usdc: 182, status: "locked" },
        ],
        starPct: 10,
        bonusUsdc: null,
        postUrl: null,
        awaitingPost: false,
        verify: null,
        metrics: null,
        txs: [{ label: "에스크로 예치 260 USDC", hash: txHash("lock-geekble") }],
      },
    ];
    feed(draft, "🔒", "에스크로 예치 660 USDC (devnet)", "money");
    feed(draft, "📦", "A2A 태스크 브리프 전송 — 기준 3 · 태스크 3 · 레퍼런스 3", "info");
  });

  // 마일스톤 1 (계약 체결 30%) 즉시 릴리즈
  step(2200, (draft) => {
    for (const deal of draft.campaign!.deals) {
      deal.milestones[0].status = "released";
      deal.milestones[1].status = "active";
      deal.starPct = 30;
      deal.txs.push({
        label: `마일스톤 1 릴리즈 ${deal.milestones[0].usdc} USDC`,
        hash: txHash(`m1-${deal.creatorId}`),
      });
    }
    draft.creatorWalletUsdc += 120;
    feed(draft, "💸", "마일스톤 1 자동 릴리즈 — 198 USDC 지급", "money");
  });

  // 씬님: 촬영 시작 → 실제 게시물 URL 제출 대기 (크리에이터 창 게이트)
  step(2600, (draft) => {
    const ssin = draft.campaign!.deals[0];
    ssin.starPct = 45;
    feed(draft, "🎬", "@ssin 촬영 시작 — 브리프 레퍼런스 2번 무드로 간대요", "info");
  });
  step(2600, (draft) => {
    const ssin = draft.campaign!.deals[0];
    ssin.starPct = 55;
    ssin.awaitingPost = true;
    feed(draft, "📤", "@ssin 업로드 대기 — 크리에이터가 게시물 URL을 제출하면 검증이 시작돼요", "info");
  });

  // 긱블 딜은 자동으로 마무리 (NPC)
  step(5200, (draft) => {
    const geekble = draft.campaign!.deals[1];
    geekble.milestones[1].status = "released";
    geekble.starPct = 100;
    geekble.postUrl = `youtube.com/watch?v=geekble-${brandHandle(brand)}`;
    geekble.metrics = { views: "26.4만", saves: "2,300", ctr: "2.1%", cpmDelta: "-18%" };
    geekble.txs.push({ label: "마일스톤 2 릴리즈 182 USDC", hash: txHash("m2-geekble") });
    feed(draft, "🧶", "@geekble_kr 타래 완성 — 182 USDC 릴리즈", "money");
  });
  return S;
}

/* ------------------------- 4.5 게시물 제출 → 검증 → 정산 ------------------------- */

/** 증빙 판정 — 하드 게이트. 통과 못 하면 다음 스텝으로 못 넘어간다. */
export function verifyPostUrl(url: string, brand: BrandProfile | null): { label: string; ok: boolean }[] {
  const t = url.trim();
  const reachable = /^https?:\/\/\S+\.\S+/i.test(t) || /^\S+\.(com|kr|net|io)\/\S+/i.test(t);
  const isSocial = /instagram\.com|youtube\.com|youtu\.be|tiktok\.com/i.test(t);
  return [
    { label: "URL 접근 가능", ok: reachable },
    { label: "지원 플랫폼 (인스타 · 유튜브 · 틱톡)", ok: isSocial },
    { label: `#광고 표기 · @${brandHandle(brand)} 태그`, ok: reachable && isSocial },
  ];
}

export function postSubmittedSequence(url: string, brand: BrandProfile | null): SequenceStep[] {
  const S: SequenceStep[] = [];
  const step = (d: number, run: SequenceStep["run"]) => S.push({ d, run });
  const checks = verifyPostUrl(url, brand);
  const passed = checks.every((c) => c.ok);

  step(0, (draft) => {
    const ssin = draft.campaign?.deals[0];
    if (!ssin || !ssin.awaitingPost) return;
    ssin.postUrl = url.trim();
    ssin.verify = null;
    ssin.awaitingPost = false;
    ssin.starPct = 70;
    feed(draft, "📤", "@ssin 게시물 제출 — 증빙 검증 시작", "info");
  });
  step(1600, (draft) => {
    const ssin = draft.campaign!.deals[0];
    ssin.verify = checks;
    if (!passed) {
      ssin.awaitingPost = true;
      ssin.starPct = 55;
      feed(draft, "🛑", "증빙 검증 실패 — URL을 확인하고 다시 제출해주세요", "warn");
    } else {
      ssin.milestones[1].status = "review";
      ssin.starPct = 85;
      feed(draft, "🔍", "증빙 검증 통과 — URL 접근 ✓ · 플랫폼 ✓ · 태그 ✓", "ok");
    }
  });
  if (!passed) return S;

  step(2200, (draft) => {
    const ssin = draft.campaign!.deals[0];
    ssin.milestones[1].status = "released";
    ssin.starPct = 100;
    ssin.txs.push({ label: "마일스톤 2 릴리즈 280 USDC", hash: txHash("m2-ssin") });
    draft.creatorWalletUsdc += 280;
    draft.burstSeq += 1;
    feed(draft, "🧶", "@ssin 타래 완성 — 280 USDC 릴리즈", "money");
  });
  step(2800, (draft) => {
    const ssin = draft.campaign!.deals[0];
    ssin.metrics = { views: "18.2만", saves: "1,540", ctr: "2.4%", cpmDelta: "-31%" };
    ssin.bonusUsdc = 40;
    ssin.txs.push({ label: "성과 보너스 릴리즈 40 USDC", hash: txHash("bonus-ssin") });
    draft.creatorWalletUsdc += 40;
    draft.burstSeq += 1;
    feed(draft, "🎁", "조회수 18.2만 (조건 15만 초과) — 보너스 40 USDC 자동 지급", "money");
  });
  step(2400, (draft) => {
    draft.campaign!.status = "completed";
    draft.campaign!.reportReady = true;
    feed(draft, "📊", "캠페인 완료 — 에이전트가 리포트 들고 귀환", "ok");
  });
  step(600, typing);
  step(1400, (draft) => {
    const r = REPORT_SUMMARY;
    agentSays(
      draft,
      `리포트 가져왔어요. 조회수 합계 ${r.totalViews}(목표 ${r.targetViews}), 저장 ${r.totalSaves}, 평균 CPM은 업계 대비 ${r.cpmVsIndustry}예요. 집행은 ${r.spentUsdc}/${r.budgetUsdc.toLocaleString()} USDC — 협상으로 예산 ${r.savedPct}%를 아꼈어요. 다음엔 오토파일럿을 켜보세요. 한도 안에서는 승인 클릭조차 제가 대신할게요.`,
      [{ id: "toggle-autopilot", label: "🚀 오토파일럿 켜기" }],
    );
  });
  return S;
}

/* ------------------------------ 5. 오토파일럿 런 ------------------------------ */

export function autopilotSequence(brand: BrandProfile | null): SequenceStep[] {
  const S: SequenceStep[] = [];
  const step = (d: number, run: SequenceStep["run"]) => S.push({ d, run });
  const push = (draft: DemoState, text: string, tone: FeedTone = "info") => {
    draft.autopilotRun?.items.push({ id: nextId(), text, tone });
  };

  step(0, (draft) => {
    draft.autopilot = true;
    draft.autopilotRun = {
      label: `캠페인 #2 — ${productName(brand, 1)} 상시 캠페인`,
      items: [],
      spentUsdc: 0,
      dealCount: 0,
      done: false,
    };
    feed(draft, "🚀", "오토파일럿 ON — 잔여 예산 300 USDC 위임", "ok");
  });
  step(1300, (draft) => push(draft, "캠페인 #2 자동 생성 — 목표·형식은 리포트 학습값 적용"));
  step(1500, (draft) => push(draft, "테크 · 라이프 크리에이터 5명 스캔 — CPM 효율 1위 @jocoding 선정"));
  step(1800, (draft) =>
    push(draft, `${AUTOPILOT_CREATOR.handle} 협상 3라운드 — ${AUTOPILOT_CREATOR.amountUsdc} USDC 체결 (한도 내 자동 승인)`, "ok"),
  );
  step(1400, (draft) => {
    push(draft, `에스크로 예치 ${AUTOPILOT_CREATOR.amountUsdc} USDC · 브리프 전송 완료`, "money");
    if (draft.autopilotRun) {
      draft.autopilotRun.spentUsdc = AUTOPILOT_CREATOR.amountUsdc;
      draft.autopilotRun.dealCount = 1;
    }
  });
  step(1600, (draft) => {
    push(draft, "사람 개입 0회 — 다음 리포트는 금요일에 도착합니다", "ok");
    if (draft.autopilotRun) draft.autopilotRun.done = true;
    feed(draft, "🌙", "오토파일럿 가동 중 — 이제 데이터만 보면 됩니다", "info");
  });
  return S;
}
