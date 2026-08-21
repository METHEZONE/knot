# 2026-08-21 GCP Live Product Web

## Goal

Use the `origin/minsung/live-product` demo workspace composition as the GCP
demo UI, while preserving the stable `main` backend/API/A2A/Agreement/Escrow
services. The demo UI must call real Product API paths for Discovery,
Matching, A2A negotiation, and Agreement state; it must not fabricate successful
escrow or settlement state.

## Branch

`gcp-live-product-web`

## Constraints

- Do not change `main` directly.
- Do not replace the backend data model or API contracts.
- Keep browser business writes behind the Product API.
- Do not claim escrow success unless the deployed API returns an escrow with a
  confirmed devnet signature.
- Do not execute new wallet funding, escrow lock, milestone release, or other
  on-chain transactions without explicit approval.

## Current Findings

- Vercel `https://thezonebio.com/knot` serves pages, but
  `/knot/api/v1/...` returns 500.
- Direct Cloud Run API is healthy:
  `https://knot-api-7k3walthgq-uc.a.run.app/readyz`.
- Existing Cloud Run web has a working `/api/v1` proxy to Cloud Run API.
- Existing Cloud Run web image is `knot-web:49c90e1`, behind local `main`.
- `origin/minsung/live-product` contains the desired demo workspace shell:
  home, campaign, deals, performance, brand, agent chat, graph view.
- The demo shell originally had deterministic post-approval escrow animation;
  in API mode this must stop at `FUNDING_REQUIRED` unless a real wallet-signed
  devnet escrow exists.

## Plan

1. [x] Bring the demo workspace routes/components into this branch.
2. [x] Keep the existing `/api/v1` proxy and connect the demo run action to real
   Product API endpoints.
3. [x] Make `/` enter the demo workspace and keep `/b`, `/c`, `/b/graph`, `/auth`
   available.
4. [x] Connect demo approval/post-submission actions to the real escrow funding,
   evidence verification, and settlement APIs. The UI must still require
   Phantom signatures and must not fabricate successful Solana transactions.
5. [x] Add demo creator settlement wallet fields to the persona seed output so
   refreshed dev/prod demo data can pass escrow prepare.
6. [x] Verify local typecheck, tests, and production build.
7. [x] Refresh deployed Firestore demo seed after explicit approval.
8. [x] Deploy only `knot-web` after explicit approval, with API mode and existing
   Cloud Run API URL.
9. [x] QA the deployed Cloud Run web URL:
   - page routes
   - `/api/v1` proxy
   - demo promotion read
   - negotiation/agreement read
   - escrow read state
10. [x] Update `docs/IMPLEMENTATION_STATUS.md` with implementation result.

## 2026-08-21 UI Polish Follow-Up

1. [x] Restore the live demo Pretendard font variable used by the
   `origin/minsung/live-product` `/b` screen.
2. [x] Prevent long Solana signatures, terms hashes, and URLs from overflowing
   demo cards.
3. [x] Fix transaction rows in Brand and Creator settlement panels so the label
   and hash wrap inside the card instead of pushing the template width.
4. [x] Re-run frontend typecheck, tests, production build, and whitespace check.
5. [ ] Deploy the UI polish build after explicit approval.
