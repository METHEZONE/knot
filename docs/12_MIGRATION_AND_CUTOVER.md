# Migration and Cutover

## Strategy

Refactor in place. Preserve reusable UI and backend modules. Do not delete old routes before new paths pass E2E.

## Inventory labels

```text
KEEP
ADAPT
REPLACE
REMOVE_AFTER_CUTOVER
ARCHIVE_DOC
```

Inventory auth, route guards, onboarding, dashboards, mocks, repositories, Firestore, A2A, escrow, and dev admin.

## Data migration

Create schema version 2. Add ownership and onboarding fields. Map local-demo users to Firebase UID only when explicit. Do not guess identity mappings. For disposable demo data, controlled reset/reseed is preferred.

## Route cutover

1. Add new resource routes.
2. Add server-backed dashboards.
3. Add legacy redirects.
4. Verify refresh/bookmarks.
5. Remove legacy implementations.
6. Remove unused fixtures.

## Dashboard Agent visualization cutover

- Added compatibility aliases for the final product URLs while preserving existing stable routes.
- Keep `/brand/negotiations/[negotiationId]`, `/creator/offers/[negotiationId]`, `/brand/agreements/[agreementId]`, and `/creator/agreements/[agreementId]` until bookmarks and QA scripts move to the final paths.
- `/creator/deals` and `/creator/deals/[dealId]` redirect to the current Agreement-backed deal surfaces.
- `/brand/settings/agent` and `/creator/settings/agent` reuse role settings until a narrower policy-only settings page is split out.
- No data migration is required for this UI pass because the new view model adapts existing Product API, A2A message, Agreement, Escrow, and Settlement payloads.

## Mock removal search

Search `mock`, `fixture`, `demo`, `setTimeout`, `glow-bar`, hardcoded IDs, fake termsHash, fake signature, and fallback success.

Mocks may remain only in tests, Storybook, or explicit local fixture mode.

## Rollback

Create branch/tag, export demo data if needed, preserve old docs, record Cloud Run revisions. Each phase must be revertible.
