"use client";

/**
 * 설정 = 내 매니저 + 내 프로필 + 표시 통화.
 *
 * 여기서 바꾼 값은 즉시 딜 보드에 반영되고, 두 창 모두 다시 협상한다 —
 * 마지노선이나 딜당 한도를 고치면 합의가 결렬로 뒤집히는 걸 이 화면에서
 * 바로 만들어볼 수 있다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AgentCharacter } from "@/components/AgentCharacter";
import { agentTraits } from "@/lib/agentIdentity";
import { Money } from "@/features/chat/Money";
import { clearBoard, readBoard, useBoard, writeBoard } from "@/product/dealBoard";
import {
  KRW_PER_USDC,
  setCurrencyMode,
  useCurrencyMode,
} from "@/product/currency";
import { BLOCKED_CATEGORY_LABEL, type BlockedCategory } from "@/product/setupStore";
import { signOut } from "@/product/session";
import type { Role } from "@/product/types";

const AGENT_ID: Record<Role, string> = {
  brand: "brand-agent-glow",
  creator: "creator-agent-mina",
};
const AGENT_NAME: Record<Role, string> = { brand: "Glow Agent", creator: "Mina Agent" };

const ALL_BLOCKED: BlockedCategory[] = [
  "gambling",
  "loanCrypto",
  "dietSupplement",
  "medicalProcedure",
  "alcohol",
  "adult",
];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-3">
        <input
          type="number"
          min={0}
          step={50}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
        />
        <Money usdc={value} size="sm" />
      </span>
      <span className="text-sm text-muted">{hint}</span>
    </label>
  );
}

export function SettingsScreen({ role }: { role: Role }) {
  const router = useRouter();
  const { board, ready } = useBoard();
  const mode = useCurrencyMode();
  const traits = agentTraits(AGENT_ID[role], role, "beauty");

  const creator = board.creator;
  const brand = board.brand;
  const mine = role === "creator" ? creator : brand;

  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  if (!ready) {
    return <div className="py-24 text-center text-muted">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
      <h1 className="text-4xl">설정</h1>

      {/* 내 매니저 */}
      <Section title="내 매니저" hint="이 캐릭터와 이름은 계정에 고정돼요.">
        <div className="flex flex-wrap items-center gap-5">
          <AgentCharacter
            agentId={AGENT_ID[role]}
            side={role}
            category="beauty"
            pose="greet"
            size={96}
          />
          <div className="flex flex-col gap-1">
            <div className="text-2xl">{AGENT_NAME[role]}</div>
            <div className="text-sm text-muted">
              {role === "brand" ? "브랜드 매니저" : "크리에이터 매니저"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span
                className="sketch-pill border-2 px-2.5 py-0.5 text-xs"
                style={{ borderColor: traits.tint }}
              >
                {traits.accessory === "sparkle" ? "뷰티 담당" : "일반 담당"}
              </span>
              <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs">
                정중함 · 유머 한 스푼
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* 내 프로필 */}
      {role === "creator" && creator ? (
        <Section title="내 프로필" hint="상대 브랜드에게는 이 중 공개 정보만 전달돼요.">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="핸들" value={creator.handle} />
              <Stat label="팔로워" value={creator.followers.toLocaleString()} />
              <Stat label="참여율" value={`${(creator.engagementRate * 100).toFixed(1)}%`} />
              <Stat label="릴스 비중" value={`${creator.reelShare}%`} />
            </div>
            <p className="text-xs text-muted">{creator.capturedAt} 수집 · 다시 연결하면 갱신됩니다</p>

            <NumberRow
              label="마지노선"
              value={creator.minUsdc}
              hint="이 밑으로 들어오는 제안은 매니저가 알아서 거절해요. (비공개)"
              onChange={(minUsdc) =>
                writeBoard({
                  creator: { ...creator, minUsdc },
                  evidenceUrl: null,
                  epoch: readBoard().epoch + 1,
                })
              }
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted">안 하는 카테고리 (비공개)</span>
              <div className="flex flex-wrap gap-2">
                {ALL_BLOCKED.map((c) => {
                  const on = creator.blocked.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        writeBoard({
                          creator: {
                            ...creator,
                            blocked: on
                              ? creator.blocked.filter((x) => x !== c)
                              : [...creator.blocked, c],
                          },
                          evidenceUrl: null,
                          epoch: readBoard().epoch + 1,
                        })
                      }
                      className={`sketch-pill border-2 border-border-subtle px-3.5 py-1.5 text-sm ${
                        on ? "bg-accent text-background" : "bg-surface text-muted"
                      }`}
                    >
                      {BLOCKED_CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {role === "brand" && brand ? (
        <Section title="내 브랜드" hint="한도는 매니저가 사람 없이 움직일 수 있는 범위예요.">
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs text-muted">제품</div>
              <div className="text-xl">{brand.productName}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {brand.moodTags.map((t) => (
                  <span
                    key={t}
                    className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <NumberRow
              label="총 예산"
              value={brand.totalUsdc}
              hint="한 프로모션에서 매니저가 쓸 수 있는 전체 상한."
              onChange={(totalUsdc) =>
                writeBoard({
                  brand: { ...brand, totalUsdc },
                  evidenceUrl: null,
                  epoch: readBoard().epoch + 1,
                })
              }
            />
            <NumberRow
              label="딜당 한도 (비공개)"
              value={brand.maxPerDealUsdc}
              hint="한 건에 이 금액까지는 물어보지 않고 씁니다. 넘으면 매니저가 멈춰요."
              onChange={(maxPerDealUsdc) =>
                writeBoard({
                  brand: { ...brand, maxPerDealUsdc },
                  evidenceUrl: null,
                  epoch: readBoard().epoch + 1,
                })
              }
            />
          </div>
        </Section>
      ) : null}

      {/* 표시 통화 */}
      <Section
        title="금액 표시"
        hint={`계약과 정산의 단위는 언제나 USDC예요. 원화는 표시 환율 1 USDC = ${KRW_PER_USDC.toLocaleString("ko-KR")}원으로 환산한 참고값입니다.`}
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "krwFirst", label: "원화 먼저", sample: "897,000원 650 USDC" },
              { key: "usdcFirst", label: "USDC 먼저", sample: "650 USDC 897,000원" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setCurrencyMode(opt.key);
                flash();
              }}
              className={`sketch-pill border-2 border-border-subtle px-4 py-2 text-left ${
                mode === opt.key ? "bg-accent text-background" : "bg-surface"
              }`}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className="font-mono text-[11px] opacity-70">{opt.sample}</div>
            </button>
          ))}
        </div>
        {saved ? (
          <p className="mt-3 text-sm" style={{ color: "var(--positive)" }}>
            저장했어요.
          </p>
        ) : null}
      </Section>

      {/* 계정 */}
      <Section title="계정">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/${role}`)}
            className="sketch-pill bg-accent px-4 py-2 text-sm text-background"
          >
            채팅으로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => {
              if (!mine) return;
              router.push(role === "creator" ? "/creator/connect" : "/brand/product");
            }}
            className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
          >
            처음부터 다시 설정
          </button>
          <button
            type="button"
            onClick={() => {
              clearBoard();
              signOut();
              router.push("/login");
            }}
            className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
          >
            로그아웃 · 데모 초기화
          </button>
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}
