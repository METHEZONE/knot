# KNOT

> Agents negotiate. Creators create. Solana settles.

KNOT은 브랜드 에이전트와 크리에이터 에이전트가 협찬 조건을 협상하고, 합의된 작업이 검증되면 Solana devnet USDC 에스크로에서 자동 정산하는 Agent-native Creator Contracting & Settlement 프로덕트입니다.

[Live Demo](https://knot-web-7k3walthgq-uc.a.run.app) · [Pitch Deck PDF](docs/assets/pitch/knotpitch.pdf)

![KNOT product home](docs/assets/readme/01-product-home.png)

## What KNOT Does

KNOT은 크리에이터 협찬을 DM, 스프레드시트, 수동 송금이 아니라 에이전트가 실행할 수 있는 거래로 바꿉니다.

1. 브랜드가 제품 URL, 작업 조건, 예산 한도를 입력합니다.
2. Brand Agent가 Creator 후보를 찾고 필요한 검증을 수행합니다.
3. Brand Agent와 Creator Agent가 HTTP A2A 메시지로 가격, 납기, 작업 범위를 협상합니다.
4. 합의가 생성되면 브랜드가 Phantom으로 devnet USDC를 에스크로에 예치합니다.
5. 크리에이터가 콘텐츠 URL을 제출합니다.
6. evidence 검증이 통과하면 정산 권한이 마일스톤을 릴리즈하고 Creator 지갑으로 USDC를 지급합니다.

핵심은 "AI가 추천한다"가 아니라 "AI 에이전트가 사람의 서비스를 계약하고, 검증하고, 정산한다"입니다.

## Demo

| Role | Email | Password | Wallet |
|---|---|---|---|
| Brand | `t1@knot.com` | `000000` | Phantom 연결 후 예치 서명 |
| Creator | `c1@knot.com` | `000000` | Phantom 연결 후 정산 수령 확인 |

Demo network:

| Item | Value |
|---|---|
| Solana cluster | `devnet` |
| Escrow program | `9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn` |
| Devnet USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

README의 데모 계정은 발표용으로 준비된 계정입니다. 실제 예치와 정산은 연결된 Phantom 지갑 주소를 기준으로 실행되며, 고정된 개인키나 seed는 브라우저나 Firestore에 저장하지 않습니다.

## Product Screens

![KNOT pitch cover](docs/assets/readme/02-pitch-cover.png)

## Architecture

KNOT은 UI와 에이전트 런타임, 결제 레일을 분리합니다. Firebase Auth가 사용자 신원을 담당하고, Firestore가 비즈니스 상태를 저장합니다. A2A 협상은 HTTP 경계를 건너며, Web3 Gateway는 Solana 트랜잭션 생성과 온체인 검증을 담당합니다.

![KNOT system architecture](docs/assets/readme/03-system-architecture.png)

## Transaction Flow

Creator 보상 에스크로와 Agent 운영 결제는 서로 다른 레일입니다.

| Rail | Purpose | Source of Funds | Recipient |
|---|---|---|---|
| Creator Compensation Escrow | 협찬 보상 예치와 마일스톤 정산 | Brand Phantom USDC ATA | Creator Phantom USDC ATA |
| pay.sh / x402 | Brand Agent의 외부 유료 검증 API 호출 | Agent operational payment wallet | Paid API provider |

Creator 보상에는 pay.sh를 사용하지 않습니다. pay.sh는 에이전트가 외부 API를 구매할 때만 사용됩니다.

![KNOT settlement sequence](docs/assets/readme/04-settlement-sequence.jpg)

## Why On-chain

크리에이터 협찬은 단순 구매가 아니라 조건부 이행 거래입니다.

- 브랜드는 결과물이 나오기 전 전체 금액을 바로 지급하고 싶지 않습니다.
- 크리에이터는 작업 완료 후 대금이 지연되는 것을 원하지 않습니다.
- 양쪽 모두 가격, 납기, 사용권, 산출물 조건을 합의해야 합니다.

KNOT은 합의 금액을 devnet USDC 에스크로에 잠그고, evidence 검증 후 마일스톤 단위로 정산합니다. 협상 메시지와 프로필은 오프체인에 저장하고, 자금 이동과 최종 증명만 온체인에 둡니다.

## Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js, TypeScript, Phantom provider |
| Auth | Firebase Auth |
| API | FastAPI, Firestore Native |
| Agent Runtime | Brand Agent, Creator Agent, HTTP A2A |
| AI | Gemini / Vertex AI for analysis and verification rationale |
| Agent Payment | pay.sh / x402 |
| Web3 | Solana devnet, Anchor, USDC, Web3 Gateway |
| Deployment | Google Cloud Run |

## Current Boundary

KNOT MVP는 Solana devnet 전용입니다. mainnet 자산은 사용하지 않습니다.

성공으로 표시되는 에스크로와 정산은 confirmed devnet signature가 있어야만 기록됩니다. 시뮬레이션 영수증, 가짜 Explorer 링크, mock payment success는 제품 경로에서 성공 처리하지 않습니다.

pay.sh는 Creator 보상 정산에 쓰지 않습니다. 배포 환경에서 pay.sh resource가 설정되지 않은 경우 Agent operational payment event는 `SKIPPED`로 기록되며, 이를 `PAID`처럼 표시하지 않습니다.

## Pitch

발표용 피치 페이지는 `https://thezonebio.com/knotpitch` 기준으로 PDF 캡처했습니다.

[Open generated PDF](docs/assets/pitch/knotpitch.pdf)
