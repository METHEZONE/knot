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

1. Bring the demo workspace routes/components into this branch.
2. Keep the existing `/api/v1` proxy and connect the demo run action to real
   Product API endpoints.
3. Make `/` enter the demo workspace and keep `/b`, `/c`, `/b/graph`, `/auth`
   available.
4. Verify local typecheck, tests, and production build.
5. Deploy only `knot-web` after explicit approval, with API mode and existing
   Cloud Run API URL.
6. QA the deployed Cloud Run web URL:
   - page routes
   - `/api/v1` proxy
   - demo promotion read
   - negotiation/agreement read
   - escrow read state
7. Update `docs/IMPLEMENTATION_STATUS.md` with final result.
