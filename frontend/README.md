# KNOT Frontend

Next.js App Router + TypeScript frontend for the KNOT product MVP.

The app is built for Google Cloud Run. Other preview hosts are not deployment
targets for this repository.

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Data Mode

Mock mode remains the default:

```bash
NEXT_PUBLIC_KNOT_DATA_MODE=mock npm run dev
```

API mode keeps the same page components but reads the Product API from the Next
server:

```bash
NEXT_PUBLIC_KNOT_DATA_MODE=api \
KNOT_API_BASE_URL=http://127.0.0.1:8080 \
npm run dev
```

API mode composes the currently implemented backend routes:

```text
GET  /api/v1/promotions
POST /api/v1/promotions/{promotionId}/matches:run
GET  /api/v1/match-runs/{matchRunId}/candidates
POST /api/v1/match-runs/{matchRunId}:start-negotiation
GET  /api/v1/promotions/{promotionId}/timeline
POST /api/v1/agreements/{agreementId}/evidence
POST /api/v1/evidence/{evidenceId}:verify
POST /api/v1/agreements/{agreementId}/escrow:lock
POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release
```

Client-side login, signup, onboarding and Promotion creation forms also call the
Product API. Browser requests go through the Next.js proxy route
`/api/v1/[...path]`, so `KNOT_API_BASE_URL` can remain server-side.

Additional form-backed routes:

```text
POST /api/v1/users:bootstrap
POST /api/v1/brands:onboard
POST /api/v1/creators:onboard
POST /api/v1/creators/{creatorId}/criteria
POST /api/v1/promotions
```

The browser does not construct A2A protocol messages. It consumes Product API
projections of matching, negotiation, Agreement Artifact and settlement state.
Escrow receipts remain visibly simulated until the backend returns real devnet
signatures.

Core product routes:

```text
/
/login
/signup
/signup/brand
/signup/creator
/brand/onboarding
/brand/products/new
/brand/negotiate
/brand/result
/brand/settlement
/brand/me
/brand/settings
/creator/onboarding
/creator/criteria
/creator/result
/creator/agreements/{agreementId}
/creator/me
/creator/settings
/dev/admin
```

Compatibility redirects:

```text
/brand/matching -> /brand/negotiate
/creator/negotiate -> /creator/result
/creator/offers -> /creator/result
/creator/milestones -> /creator/result
```

The workspace navigation is intentionally not a numbered stepper. Role pages do
not render an internal sidebar, because onboarding is not the beginning of a
single transaction funnel. After onboarding, a Brand can create many Promotions
and a Creator can receive many agent-negotiated offers. The global header keeps
only broad navigation; `My` and `Settings` are account actions near the page
title, not deal-flow steps.
Mock data flows through `src/product/dataSource.ts`; replacing it with a
Firestore/API-backed implementation should not require route component changes.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Cloud Run Container

```bash
docker build -t us-central1-docker.pkg.dev/knot-dev-503505/knot/knot-web:local .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  us-central1-docker.pkg.dev/knot-dev-503505/knot/knot-web:local
```

Production Cloud Run config must pass public Firebase values and API base URLs
as environment variables. Do not put service account JSON, API tokens, seed
phrases, private keys, or signer material in `NEXT_PUBLIC_*`.
