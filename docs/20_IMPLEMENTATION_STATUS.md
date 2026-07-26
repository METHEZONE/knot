# KNOT v1 Implementation Status

Update this file at the end of every task.

## Current milestone

`M4 complete + product MVP frontend/API/GCP deploy baseline in progress`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | Product MVP API integration expanded | 2026-07-27 | Branch `integration/frontend-backend-api`; API mode is now the default, and `NEXT_PUBLIC_KNOT_DATA_MODE=mock` is an explicit fixture-only override. `KnotDataSource` reads Product API-backed Promotion→MatchRun→Negotiation→Agreement→Evidence→Escrow composition without page-load write fallbacks. Login/signup/onboarding/Promotion creation forms submit to Product API through a Next `/api/v1/[...path]` proxy. |
| knot-api | Account/onboarding + A2A/escrow/pay.sh API | 2026-07-27 | Product API can run against Firestore, call Creator A2A over HTTP, call web3 gateway lock/release endpoints, and record pay.sh/x402 `API_PAYMENT` PromotionEvents. API container now installs the Node 20+ `pay` CLI dependency through a Node 22 Docker stage so Cloud Run can generate live sandbox receipts when `PAYSH_RESOURCE_ID` is configured. |
| creator A2A service | HTTP negotiation baseline | 2026-07-27 | A2A send/stream/tasks/cancel endpoints backed by in-memory task store; demo tenants cover seeded creator agents 001/002/003 and Cloud Run deploy config is now included. |
| web3 gateway | Lock/release validation + deployable gateway | 2026-07-27 | Validates lock and milestone release requests, idempotent simulated receipts, persisted non-secret live lock context, and optional `KNOT_WEB3_SIGNING_MODE=devnet` Solana submitter using `@solana/web3.js`/`@solana/spl-token`; Cloud Run deploy config is now included. |
| Anchor program | Deployed to devnet | 2026-07-25 | `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj`; on-chain milestone settlement verified — agent releases USDC within cap with no human. Duplicate no-op `web3/program` stub removed; only `programs/knot-escrow` remains |
| Terraform/GCP | direct Cloud Run deploy baseline | 2026-07-27 | Target project `knot-dev-503505`; Firestore Native `(default)` and Artifact Registry repo `us-central1/knot` exist. Direct deploy script now builds/deploys `knot-web`, `knot-api`, `knot-creator-agent`, and `knot-web3`; Terraform is still not authored/applied. |
| end-to-end demo | settlement leg proven on devnet; Cloud Run full-service deploy pending smoke | 2026-07-27 | On-chain escrow settlement verified previously. Full Cloud Run service boundary is now scripted; live signer/pay.sh resource configuration remains external. |

## Contract versions

```text
Product API: v1
A2A: 1.0
Negotiation payload: knot.negotiation.v1
Agreement payload: knot.term-sheet.v1
Matching weights: matching-v1
Brand policy: brand-policy-v1
Creator policy: creator-policy-v1
Evidence policy: verification-v1
Escrow program: Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj (Solana devnet)
Devnet USDC-SPL mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## Latest validation

```text
python -m ruff check backend: passed.
python -m mypy backend/apps backend/libs: passed, 38 source files.
python -m pytest backend/tests: 59 passed, 4 skipped (firestore-emulator + devnet gated; pay.sh sandbox smoke runs when the `pay` CLI is present).
cd web3/gateway && npm run lint / npm test / npm run build: passed, 5 tests.
anchor build: passed; target/idl/knot_escrow.json generated.
anchor deploy (devnet): deployed program Aj63…; program account rent-exempt ~2.035 SOL (recoverable via `solana program close`).
KNOT_RUN_DEVNET=1 pytest backend/tests/test_escrow_devnet.py: 1 passed — real on-chain milestone settlement (agent released 0.7 USDC to the creator within cap; Reputation.total_settled updated).
cd frontend && npm run lint: passed.
cd frontend && npm test: passed; 7 product flow/data-source tests.
cd frontend && npm run build: passed; 27 dynamic app routes generated including login/signup, brand product/result/settlement, creator criteria/result/brand detail, role my/settings and dev admin.
cd frontend && npm run typecheck: passed.
cd frontend && npm run dev: running at http://localhost:3000; smoke 200 for /login, /signup, /brand/products/new, /brand/settlement, /creator/result, /dev/admin, /brand/negotiate, /brand/me, /creator/settings.
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py: 25 passed, 1 Starlette/httpx deprecation warning.
API mode smoke with local knot-api at http://127.0.0.1:18080 and frontend at http://127.0.0.1:3002: 200 for /brand/products/new, /brand/negotiate, /creator/result, /brand/settlement and /dev/admin. Backend logs confirmed Promotion→MatchRun→Negotiation→Evidence→Escrow lock→Milestone release calls.
cd backend && ../.venv/bin/python -m pytest tests/test_api_onboarding.py tests/test_api_promotions.py tests/test_api_escrow.py: 20 passed, 1 Starlette/httpx deprecation warning.
cd backend && ../.venv/bin/python -m ruff check apps/api libs/repositories tests/test_api_onboarding.py: passed.
cd frontend && npm run typecheck / npm run lint / npm test / npm run build: passed after account/onboarding API integration; build includes dynamic `/api/v1/[...path]` proxy.
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py: 25 passed, 1 Starlette/httpx deprecation warning after Phase 1 read-contract cleanup.
cd backend && ../.venv/bin/python -m ruff check apps/api libs/repositories tests/test_api_promotions.py tests/test_api_escrow.py: passed.
cd frontend && npm run typecheck / npm run lint / npm test: passed; product flow tests now cover API default mode and no page-load negotiation writes.
cd frontend && KNOT_API_BASE_URL=http://127.0.0.1:18080 NEXT_PUBLIC_KNOT_DATA_MODE=api npm run build: passed with network access for Google Fonts.
Local smoke after backend restart: `GET /readyz` on :18080 passed; frontend :3000 returned 200 for `/login`, `/dev/admin`, `/creator/result`, and `/brand/negotiate`.
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py: 28 passed, 1 Starlette/httpx deprecation warning after Creator A2A HTTP boundary.
cd backend && ../.venv/bin/python -m ruff check apps/api apps/creator_agent libs tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py: passed.
cd backend && ../.venv/bin/python -m mypy apps libs: passed, 39 source files.
Local HTTP A2A smoke: temporary Creator Agent :18081 + Product API :18082 with `KNOT_CREATOR_A2A_MODE=http` returned `AGREED`, real A2A task id, and Agreement id. Temporary smoke servers were stopped.
Local current servers: backend :18080 `/readyz` 200; frontend :3000 `/dev/admin` 200.
Frontend onboarding form fix: brand/creator onboarding now trims form values,
falls back only on blank values, normalizes URL fields with `https://` when a
scheme is omitted, and surfaces FastAPI 422 validation details as readable form
errors. `cd frontend && npm run typecheck / npm run lint / npm test`: passed.
No-eligible-creator negotiation guard: Product API now returns
`NO_ELIGIBLE_CREATOR` instead of a generic missing `selectedCreatorAgentId`
state, frontend API mode stops before `start-negotiation` when MatchRun has no
selected creator, and matching/policy category checks normalize common Korean
and English category aliases. Backend pytest/ruff/mypy and frontend
typecheck/lint/unit tests passed.
Product creation now exposes `usageRights` instead of hard-coding it, and the
demo fitness/health creator seed accepts `paidBoost30d` so the current local
health Promotion can complete the API-backed Agent flow. Local smoke through
`:3000` proxy for `promotion-9c3beb19-307a-404b-808b-c08e95ef3ad2` returned a
new eligible MatchRun (`creator-agent-002`) and `start-negotiation` 201 with an
AGREED negotiation and Agreement.
New frontend-created Promotions now default `autoEscrow` and `autoRelease` to
`true` for the MVP demo path so Agreement → escrow lock → evidence verify →
milestone release can be exercised without the human-approval placeholder
blocking settlement.
Local runtime was switched to a real service boundary for agent negotiation:
Creator Agent runs on `:18081`, Product API runs on `:18080` with
`KNOT_CREATOR_A2A_MODE=http`, and local smoke through the Next proxy completed
Promotion match → HTTP A2A negotiation → Agreement → escrow lock → evidence
verify → content milestone release. Receipts remain `SIMULATED` until the web3
gateway is wired.
Verification after this pass: backend targeted pytest `32 passed`, backend Ruff
passed, backend mypy passed, frontend typecheck/lint/unit tests passed, and
frontend production build passed after allowing Google Fonts network access.
- Added optional Vertex AI Gemini provider boundary. `KNOT_GEMINI_MODE=vertex`
  lets candidate explanations and Creator Agent display rationale call Gemini
  via `google-genai`; default `off` keeps deterministic fallback text. Gemini
  output remains non-authoritative and cannot change matching eligibility,
  ranks, terms, escrow lock, or milestone release.
Vertex AI API (`aiplatform.googleapis.com`) is enabled in `knot-dev-503505`.
Local Vertex smoke passed with `gemini-2.5-flash`. Local HTTP A2A smoke through
the Next proxy produced `analysisProvider=vertex-gemini` on MatchCandidate and
`rationaleProvider=vertex-gemini` on the Creator Agent response message.
Web3 gateway boundary pass: `KNOT_WEB3_MODE=gateway` makes Product API call
private gateway lock/release endpoints and persist the returned
`gatewayReceipt`. Verification: `cd backend && ../.venv/bin/python -m pytest
tests/test_api_escrow.py tests/test_api_promotions.py tests/test_a2a_negotiation.py`
passed with 33 tests, backend Ruff passed, backend mypy passed, and
`cd web3/gateway && npm test / npm run lint / npm run build` passed. Local
gateway-mode smoke on `:18084` through gateway `:18083` completed
Promotion→MatchRun→Negotiation→Evidence→Escrow lock→Milestone release with
`lockGatewayReceipt=true` and `releaseGatewayReceipt=true`.
pay.sh/x402 boundary pass: `matches:run` now records `API_PAYMENT`
PromotionEvents. `PAYSH_RESOURCE_ID=replace-me` records `SKIPPED`; configured
sandbox resources call the `pay` CLI and persist receiptId/correlationId/status
without affecting candidate ranking, terms, escrow lock, or release. Verification:
backend targeted pytest now passes with 35 tests; backend Ruff and mypy passed.
web3 signing mode pass: gateway now has `KNOT_WEB3_SIGNING_MODE=devnet`, reads
a devnet-only brand signer plus demo creator/agent signers from keypair
file/env/Secret Manager mount, submits Anchor `initialize_campaign`, then
`submit_milestone` + `approve_and_release`, and returns devnet explorer URLs.
Product API lock payload now sends milestone ids/amounts to keep Firestore and
on-chain split aligned. Lock receipts include non-secret `liveContext`, and
Product API sends that context back on release so Cloud Run does not depend on
in-process gateway memory. Verification:
`cd web3/gateway && npm run build / npm test / npm run lint` passed.
`cd backend && ../.venv/bin/python -m pytest tests` passed with 70 passed and
5 skipped. Frontend typecheck/lint/unit tests/build passed. Live
devnet smoke was not run in this environment because Solana CLI/Anchor and
`~/.config/solana/id.json` are absent, and `pay` CLI is also absent.
`cd web3/gateway && npm audit --audit-level=high` reports high transitive
advisories through Solana JS and ESLint dependency trees; the suggested
`--force` remediation is breaking, so it was not applied in this pass.
GCP `knot-dev-503505`: enabled Firestore + Cloud Build, created Artifact Registry repo `us-central1/knot`, created Firestore Native `(default)` in `us-central1`, seeded demo docs, and smoke passed against real Firestore.
Cloud Run: deployed `knot-api` at https://knot-api-260001601654.us-central1.run.app and `knot-web` at https://knot-web-260001601654.us-central1.run.app.
Cloud Run smoke: `GET /readyz` on knot-api passed; `GET /api/v1/promotions` on knot-api passed; `GET /`, `/brand/negotiate`, `/dev/admin` on knot-web passed; `GET /api/v1/promotions` through knot-web proxy passed.
```

## Decisions made during implementation

- Imported the v1 source-of-truth documentation into `docs/`.
- Kept external prompt files out of the repository per current working instruction.
- Renamed `config/env.example` to root `.env.example`.
- Treated `frontend`, `backend`, and `web3` as the three primary code areas; `infra` and `scripts` will be added only when needed.
- Added commit rules to `AGENTS.md`, including domain-prefixed commit messages and mandatory user approval before committing.
- Added typed domain models, deterministic Brand/Creator/Evidence policy functions, `matching-v1` scoring, A2A v1 models, an in-memory A2A task store with idempotency, and deterministic `termsHash`.
- Added the Firestore-compatible `DocumentStore`, in-memory + adapter implementations, path helpers, serialization, demo seed, and gated emulator integration tests.
- Added Product API routes for Promotion, match run, negotiation, agreement, evidence, and the Promotion timeline; kept Gemini out of every authorization boundary (deterministic placeholders).
- **Merged `be` and `hyo/blockchain-setup` into `main`** through `integrate/be-blockchain` (PR #1). Unified `backend/pyproject.toml`; disabled the anchorpy pytest plugin (`-p no:pytest_anchorpy`) that imports the removed `pytest_xprocess`; fixed lint/type issues surfaced by the merge.
- **Added escrow lock/release API** (`/agreements/{id}/escrow:lock`, `/escrows/{id}`, `/escrows/{id}/milestones/{mid}:release`, `/transaction-receipts/{id}`) with `libs/payments/settlement.py` (fee 0 → lock == payable fixed amount), termsHash re-check, autoEscrow/autoRelease gates, evidence-passed precondition, PaymentOperation + IdempotencyRecord + audit, and idempotent replay. Receipts are SIMULATED as a seam for real signing. 14 new tests.
- Refactored the escrow routes (shared idempotency/receipt/operation helpers; reuse of `canonical_json`/`sha256_prefixed`; release reads the stored milestone split) with no behavior change.
- **Installed the Solana/Anchor toolchain and deployed the program to devnet.** The original `Hv74…` program keypair was gitignored/unavailable, so `anchor keys sync` adopted the built keypair id `Aj63…`; propagated it across `declare_id`, `Anchor.toml`, `pdas.py`, backend `Settings`, gateway config, and `.env.example`.
- **anchorpy 0.21 cannot parse anchor 1.x's new IDL format**, so `test_escrow_devnet.py` builds instructions with solders directly instead of `knot.escrow.client.load_program`. It reuses the singleton config's treasury/mint so it is repeatable.
- Removed the duplicate no-op Anchor workspace `web3/program`; the only retained Anchor workspace is `programs/knot-escrow`.
- Switched the GCP target project to `knot-dev-503505`; earlier Firestore live verification in the previous dev project is obsolete and must be re-run there.
- Normalized docs so Product/API/Firestore/frontend terminology is Promotion; current Anchor `campaign` names are documented as legacy on-chain API names only.
- Added `docs/23_EXPERIENCE_PRD_v2.md` (onboarding/hatching/expedition/replay/dashboards experience layer, tiered against the 8/3 gates) and scaffolded `frontend/` per AGENTS.md stack rules; user-visible copy audited for canonical "Promotion" terminology; SIMULATED receipts render without fabricated explorer links.
- Implemented the hatching onboarding both sides (PRD v2 §4/§5): `/onboarding/creator` (socials → diagnosis card → rate card & rules → ceremony → wallet) and `/onboarding/brand` (website → brand profile card → autonomy dials → ceremony → first-Promotion handoff), plus `/demo` role entry honouring `?demo=brand|creator` per PRD v2 §3. AGENTS.md's v1 "do not implement onboarding" rule was updated to point at the PRD v2 amendment.
- Added the parametric agent character system (`src/lib/agentIdentity.ts`, `AgentCharacter`, rewritten `AgentAvatar`): look and name derive deterministically from agentId + diagnosis category, so the agent that hatches is the agent that appears in the theater and on the map. Replaces the monogram placeholder.
- The ceremony's signing beat renders the real mandate: `src/lib/onboardingPolicy.ts` builds the same `agentPolicies` shape the engine reads (field/rule names mirror `backend/libs/policies/{creator,brand}.py`), so what the user watches get signed is what gates the agent.
- Added onboarding contract types and fixtures (`CreatorIngest`, `CreatorDiagnosisV1` = `diagnosis-v1`, `BrandIngestV1`, onboard requests/results) with client + demo-provider methods for `POST /creators/{id}/ingests`, `GET /creators/{id}/diagnosis`, `POST /creators:onboard`, `POST /brands:ingest`, `POST /brands:onboard`. All demo-backed by committed fixtures per 16 §4; every diagnosis number derives from the ingest and `narrative` is the only model-written field, labelled as such. Cached captures render "captured {date}" per 17 §3.
- Restyled the whole app to the scribbled-paper design language of the `/knot` marketing landing: cream paper + a single ink colour, handwritten headlines (Caveat/Gaegu) with mono retained for money/hashes/JSON, hand-drawn `sketch`/`ink` outlines replacing printed corners, paper grain, and `feTurbulence` squigglevision on headlines and line-art only. Category hue survives as coloured-pencil fill so parametric identity still reads. Reduced-motion disables every wobble.
- Added the public-replay OG/Twitter image (`/replay/[negotiationId]/opengraph-image`), amount-masked by default with the round count read from persisted negotiation data.
- Split the Promotion wizard into a 5-step stepper (basics → deliverables → budget → rules → autonomy & review) with no change to fields, defaults, validation or the `createPromotion` payload.
- Started frontend GCP migration on branch `frontend/gcp-migration`, using `docs/KNOT_MVP_v1_1_Document_Pack` for the detailed frontend route/data contract and current repository docs for system constraints.
- Added `frontend/src/mvp/*` contract/mock/logic layer with deterministic Promotion lifecycle data, policy ladder validation, term diff, SSE/message dedupe, milestone amount splitting and Explorer link safety.
- Rebuilt the route surface to the MVP pack map, then applied the MVP scope change that removes the Society Map: `/login`, `/onboarding/{brand,creator}/*`, `/brand/dashboard`, `/brand/promotions`, `/brand/promotions/new`, `/brand/promotions/{promotionId}`, candidates/workflow tabs, brand/creator negotiation pages, agreement, payment, evidence, creator dashboard/offers/deal, and shared settings.
- Retained the existing hand-drawn paper/ink design language while replacing route-level prototypes with reusable MVP cards, status badges, onboarding shell, lifecycle controls, Agent Workflow execution log and accessible timeline.
- Switched frontend build output to Next standalone and added a Cloud Run Dockerfile/.dockerignore. Other preview hosts are ignored for this migration.
- Restored the long-form waitlist landing as `/`, with local-only waitlist capture, Brand/Creator demo onboarding CTAs, and `?demo=brand|creator` deep-link handling.
- Removed `frontend/src/features/map` and the `/brand/promotions/{promotionId}/society` route. The Promotion Control Center now links to `/brand/promotions/{promotionId}/workflow`, which separates Agent API Spend through pay.sh/x402 from Deal Escrow compensation.
- Superseded the broad MVP pack route map with a product MVP flow: root problem landing, login/signup, Creator onboarding/criteria/result/brand-detail, Brand onboarding/product/negotiation/result/settlement, role my/settings pages, and dev admin.
- Removed legacy frontend routes and unused feature/API fixture layers from `frontend/src` so the visible app matches the product MVP flow.
- Updated the product MVP UX so creator offers, brand matching and negotiation
  are presented as A2A agent work. Screens show animated agent progress,
  sanitized status and negotiated results; private policy fields and internal
  pricing/scoring details are intentionally hidden from the counterparty.
- Added `frontend/src/product/{dataSource,mockData,types,flow}.ts` so current
  mock state can be replaced by Firestore/API-backed data without changing page
  components.
- Reworked the product frontend away from a connected 01/02/03 stepper. The
  workspace nav no longer renders as an internal sidebar or linear sequence.
  The global header keeps only broad navigation, each business page carries the
  current page title at the top, and account routes (`My`, `Settings`) are
  exposed as small page-header actions outside the deal/Promotion flow.
- Added product-like login/signup pages. Signup selects Brand or Creator first,
  then continues into role onboarding/profile creation.
- Added Creator result list and brand detail page with agreed-deal milestones
  and settlement status. Non-agreed deals show sanitized outcome only.
- Added API mode for `frontend/src/product/dataSource.ts`. It reads the Product
  API from `KNOT_API_BASE_URL`/`NEXT_PUBLIC_KNOT_API_BASE_URL`, composes the
  implemented backend endpoints, maps backend Promotion/Agreement/Escrow data
  into the current role UX, and preserves mock mode as the default.
- Verified the A2A boundary for frontend integration: browser code does not
  construct official A2A Message/Task/Artifact payloads; it reads Product API
  projections created by backend orchestration. Creator A2A endpoints remain
  service-side.
- Added Product API account/onboarding persistence for the current site build:
  `POST /users:bootstrap`, `POST /brands:onboard`,
  `POST /creators:onboard`, and `POST /creators/{creatorId}/criteria`.
  These write `users`, `brands`, `creatorProfiles`, `agents`, and
  `agentPolicies` through the repository boundary and can run against memory or
  Firestore. No password, token, private key, seed phrase, or payment authority
  is stored.
- Added a Next.js `/api/v1/[...path]` proxy so browser-side forms can call the
  Product API without exposing server-only backend base URL config. Web3
  payment execution is intentionally excluded from this pass.
- Added minimal GCP deployment assets and performed a direct Cloud Run deploy:
  `.gcloudignore`, `infra/cloudbuild/api.yaml`, and `infra/cloudbuild/web.yaml`.
  Deployed services are public for the current demo baseline; production auth
  tightening remains pending.
- Rewrote `docs/24_PRODUCT_FLOW_AND_FEATURES.md` in Korean for product/user-flow
  handoff and explicitly documented that SNS/PDF analysis is not live yet.
- Read `KNOT_MVP_REAL_A2A_ESCROW_DEVELOPMENT_PROMPT` and implemented the scoped
  Phase 1 cleanup: API mode is the frontend default, mock mode is explicit,
  API reads no longer run match/negotiation/settlement writes on page load,
  creator detail routing uses `agreementId`, and Product API gained read-only
  Agreement/escrow lookup endpoints for frontend composition.
- Implemented Phase 2 Creator A2A HTTP boundary: `KNOT_CREATOR_A2A_MODE=http`
  makes Product API call `CREATOR_AGENT_BASE_URL/message:send` with official
  A2A v1 headers, persist returned Task/Message/Artifact state, and create an
  Agreement only from an accepted Artifact. Local mode remains the deterministic
  seed fallback.

## Known blockers / open items

- Gateway devnet signing code exists, but live smoke/deployment still needs
  brand/creator/agent devnet signers mounted through Secret Manager and funded
  with the correct devnet SOL/USDC-SPL balances.
- web3 gateway npm audit reports transitive high advisories in Solana JS/Eslint
  dependency trees; resolving them needs dependency-major evaluation rather than
  automatic `npm audit fix --force`.
- Terraform is still not implemented/applied; current GCP deploy was direct
  `gcloud` setup for the demo baseline.
- Dedicated least-privilege runtime service accounts are not configured yet;
  current Cloud Run services use the default runtime identity.
- pay.sh flow-1 is wired into Brand Agent matching as an `API_PAYMENT`
  PromotionEvent, and the API image includes the `pay` CLI. A real sandbox
  `PAYSH_RESOURCE_ID` is still required to produce a fresh settled x402 receipt
  during the live demo.
- Frontend product MVP has API-backed local-demo login/signup/onboarding and
  Promotion creation. Firebase Auth and production session enforcement are
  still pending.
- API mode settlement displays Product API receipts. They are `SIMULATED` by
  default and can become `CONFIRMED` only when Product API uses gateway mode and
  gateway runs with `KNOT_WEB3_SIGNING_MODE=devnet`.
- `knot.escrow.client` (anchorpy) is broken against anchor 1.x IDL until anchorpy supports the new format or the client is ported to solders.
- Firebase Auth/session enforcement is still pending. Current login/signup is
  `local-demo` account bootstrap through Product API and stores only account
  context, not credentials.
- Real Brand PDF/file analysis, live Creator SNS ingestion, and Gemini-backed
  evidence content extraction are still pending. Current onboarding persists
  user-entered profile data and generated summaries.
- Wallet issuance/custody interface is still unresolved. Frontend displays only
  public wallet references and never accepts private keys or seed phrases.
- Frontend dependency audit remediation is pending; Cloud Build surfaced npm
  high-severity findings that still need review.
- Product API→Creator Agent HTTP is implemented and the demo deploy script
  enables it. Private service-to-service OIDC/IAM invocation is not wired yet.

## Next task

Run the four-service Cloud Run deploy script, smoke the deployed API/web/A2A
gateway boundary, then configure Secret Manager signers and a real pay.sh
sandbox resource for live receipt smoke.
