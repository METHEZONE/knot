# Card-Deck Onboarding UX

## 1. Design preservation

Use the existing KNOT card, paper, handwriting, typography, button, spacing, motion, and responsive components. Do not replace the experience with a conventional multi-column form or a new dashboard design system.

The behavioral pattern is:

```text
one card
→ one question or confirmation
→ immediate save
→ transition to next card
```

## 2. Interaction rules

- Desktop supports click and left/right arrow navigation where appropriate.
- Mobile supports swipe and tap.
- Selection is shown briefly before the card moves.
- Previous answers remain saved when navigating backward.
- Refresh resumes from backend onboarding state.
- Every async card has loading, partial, retry, and failure states.
- User-confirmed fields are distinguished from AI-proposed fields.
- The progress count describes cards, not business steps.
- Accessible focus order and reduced-motion mode are required.

## 3. Brand card deck

### Card 1 — product source

```text
제품 링크만 주세요
붙여넣으면 나머지는 매니저가 읽어옵니다.
```

Input:
- HTTPS product URL.

Action:
- `읽어오기`.

Validation:
- URL allowlist/security rules;
- normalized URL;
- duplicate analysis reuse when source/version is unchanged.

### Card 2 — analysis

```text
제품을 읽고 있어요
```

Real progress events may include:

- source fetch;
- content extraction;
- Gemini structured analysis;
- mood proposal;
- embedding generation.

Do not animate fake steps if no corresponding event exists. A generic indeterminate animation is acceptable while awaiting a real job.

### Card 3 — product confirmation

Show only concise fields:

- image when safely available;
- product name;
- price when extracted;
- category;
- one-line description;
- target audience summary;
- extraction confidence/unknown indicator.

Actions:

```text
맞아요
조금 고칠래요
```

Unknown data remains unknown. Never invent sales, reviews, audience metrics, or claims.

### Card 4 — desired mood

Use shared controlled mood IDs. Gemini proposes up to three; the user confirms one or two.

Example:

- 깨끗한 미니멀;
- 자연스러운 웰니스;
- 친근한 데일리.

The existing swipe/card-selection visual must be reused.

### Card 5 — content format

MVP single format:

- Instagram Reel;
- Feed;
- Short-form video.

One is selected for the Promotion. Creator profiles may support multiple.

### Card 6 — negotiation budget

```text
어느 범위에서 협상할까요?
```

Fields:

- target amount USDC;
- hard maximum USDC.

Invariant:

```text
0 < targetAmountUsdc <= maxAmountUsdc
```

The hard maximum is private.

### Card 7 — deadline

Select final publication deadline. UI may offer suggested presets but saves an exact date/time and timezone.

### Card 8 — usage rights

MVP presets:

- Organic only;
- Paid boost 30 days.

Keep one selected preset. Advanced rights are post-MVP.

### Card 9 — paid verification cap

```text
후보를 더 정확히 검증할까요?
```

Values:

- free signals only;
- fixed cap such as 0.5 or 1 USDC;
- custom amount if current design supports it.

This cap is separate from creator compensation.

### Card 10 — wallet and authority

Show:

- connected Brand/agent wallet;
- devnet USDC balance;
- maximum per-run escrow authority;
- paid API spend cap;
- explicit explanation of autonomous actions.

Do not expose private key material. If the current implementation uses a user wallet approval rather than delegated authority, the UI and copy must state that truthfully.

### Card 11 — summary

```text
에이전트가 이렇게 움직여요
```

Summary:

- product;
- moods;
- format;
- target/max budget;
- deadline;
- rights;
- paid verification cap;
- wallet/authority.

CTA:

```text
에이전트 준비 완료
```

Completion creates/updates Profile, Promotion, Brand Agent policy/authority, analysis snapshot, and onboarding state. It does not immediately start a Match Run.

## 4. Creator card deck

### Card 1 — profile source

```text
YouTube 링크만 주세요
```

Accept a supported public YouTube channel, video, or Shorts URL as the MVP
default. Use official/public YouTube metadata first, then Gemini structured
analysis for style/category proposals. Instagram may be accepted as a secondary
manual URL, but the MVP must not depend on Instagram scraping. If any source is
unavailable or access-limited, show a truthful limited analysis and allow manual
confirmation rather than fabricating metrics.

### Card 2 — analysis

```text
콘텐츠를 살펴보고 있어요
```

Possible real stages:

- source validation;
- publicly accessible YouTube metadata extraction;
- Gemini structured analysis;
- mood proposal;
- embedding generation.

### Card 3 — profile confirmation

Show:

- display handle/name;
- categories;
- content formats;
- one-line style summary;
- representative links/images when actually collected;
- unknown/limited data indicator.

Actions:

```text
맞아요
조금 고칠래요
```

### Card 4 — creator mood

Gemini proposes mood IDs from the same taxonomy used by Brand products. User confirms or replaces them.

### Card 5 — supported formats

Multi-select formats the Creator Agent may accept.

### Card 6 — negotiation range

Private values:

- target amount USDC;
- absolute minimum amount USDC.

Invariant:

```text
0 < minimumBaseUsdc <= targetBaseUsdc
```

The exact minimum never appears in Brand DTOs or discovery documents.

### Card 7 — minimum lead time

Presets:

- 3 days;
- 5 days;
- 7 days;
- 14 days.

Save normalized days and optional next available timestamp.

### Card 8 — usage rights

Select maximum rights the agent may accept automatically.

### Card 9 — blocked categories

Multi-select private non-negotiable categories. Store exact values only in private policy.

### Card 10 — settlement wallet

Show:

- connected Solana wallet;
- destination address;
- network;
- test verification state.

### Card 11 — publish summary

```text
에이전트가 이렇게 협상해요
```

Explain:

- public profile;
- private target/minimum;
- accepted formats;
- lead time;
- rights;
- blocked categories;
- settlement wallet;
- capacity.

CTA:

```text
제안 받기 시작
```

Completion publishes the Agent if all required checks pass.

## 5. Shared mood taxonomy

Initial set:

| ID | Korean label |
|---|---|
| `clean_minimal` | 깨끗한 미니멀 |
| `warm_lifestyle` | 따뜻한 라이프스타일 |
| `natural_wellness` | 자연스러운 웰니스 |
| `premium_editorial` | 프리미엄 에디토리얼 |
| `playful_colorful` | 생기 있는 컬러풀 |
| `friendly_daily` | 친근한 데일리 |
| `expert_informative` | 전문적인 정보형 |
| `trendy_bold` | 트렌디하고 대담한 |
| `cute_cheerful` | 귀엽고 유쾌한 |
| `authentic_review` | 솔직한 리얼리뷰 |

Taxonomy version must be stored with analyses and embeddings.

## 6. Persistence

Each card saves a versioned draft. Completion is idempotent.

Suggested onboarding state:

```json
{
  "role": "BRAND",
  "status": "IN_PROGRESS",
  "currentCard": "BUDGET",
  "completedCards": ["SOURCE", "ANALYSIS", "PROFILE", "MOOD", "FORMAT"],
  "analysisJobId": "job-...",
  "draftVersion": 4,
  "updatedAt": "timestamp"
}
```

## 7. Truthful modes

### Live mode

- real backend jobs;
- real Gemini credentials;
- no fixture fallback;
- errors are visible.

### Explicit demo mode

- fixed fixtures are allowed only behind a documented flag;
- UI clearly identifies simulated external data where relevant;
- no fake on-chain signature or paid API receipt.
