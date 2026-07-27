/**
 * 손그림 흔들림 필터.
 *
 * 튜닝 원칙 — 지지직거리지 않게:
 * - `baseFrequency`가 크면 파장이 짧은 노이즈가 되어 글자를 갉아먹는다.
 *   손으로 그린 선의 흔들림은 파장이 길다(0.01 근처). 0.03을 넘기면 정전기다.
 * - `numOctaves`는 1. 2 이상이면 고운 결이 한 겹 더 얹혀 그 결이 정전기처럼
 *   보인다.
 * - `scale`은 폰트 크기에 비해 작게. 본문 19px 기준 1~2px면 충분하다.
 * - 시드는 느리게 넘긴다. 0.4초에 4단계면 초당 10프레임이라 스트로브처럼
 *   보이고, 0.8초에 4단계(초당 5프레임)면 손이 떨리는 속도로 읽힌다.
 *
 * `calcMode="discrete"`는 시드를 보간하지 않고 툭툭 바꾼다 — 러프 애니메이션이
 * 다시 그려지는 느낌을 내기 위한 것이고, 그래서 느린 속도가 특히 중요하다.
 *
 * 서버 컴포넌트라 클라이언트 번들 비용이 없다. reduced-motion 사용자는
 * globals.css에서 `filter: none`이 되므로 애니메이션 자체가 적용되지 않는다.
 */
export function SquiggleFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* 기본 — 헤드라인용. 가장 얌전하다. */}
        <filter id="knot-squiggle-1" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.009"
            numOctaves={1}
            seed={1}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="1;4;7;10"
              dur="0.85s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" />
        </filter>

        {/* 조금 더 살아 있는 버전 — 작은 장식 요소용. */}
        <filter id="knot-squiggle-2" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.012"
            numOctaves={1}
            seed={3}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="3;6;9;12"
              dur="0.75s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
        </filter>

        {/* 선화(캐릭터·알·주머니)용 — 면적이 크니 진폭은 크되 아주 느리게. */}
        <filter id="knot-squiggle-3" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.007"
            numOctaves={1}
            seed={7}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="7;11;15"
              dur="1.1s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
        </filter>
      </defs>
    </svg>
  );
}
