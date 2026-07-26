# Real Authentication, Onboarding, and Dashboard

## Authentication

Use Firebase Auth as the real identity source. The Product API verifies ID tokens using Firebase Admin SDK and never trusts a frontend-supplied `userId`.

```text
Firebase sign-in
→ obtain ID token
→ Product API verifies token
→ GET /api/v1/me
→ route guard uses server response
```

Production API mode must not use `local-demo`. Emulator mode must be explicit.

## User bootstrap

First verified request idempotently creates `users/{uid}` with role null and `ROLE_REQUIRED`.

## Role selection

One role per user in MVP. Role selection persists on the server, creates a DRAFT Agent shell if needed, and redirects to role onboarding.

## Brand one-page onboarding

Required:

- brand name
- website URL
- categories: multi-select + custom
- primary target audience

Optional:

- description
- restricted claims

Do not collect product name, Promotion title, budget, per-creator maximum, deliverables, usage rights, or deadline.

Submit creates Brand Profile, activates Brand Agent, completes onboarding, and redirects to `/brand`.

## Creator one-page onboarding

Required:

- creator display name
- at least one social reference URL
- categories: multi-select + custom
- base minimum sponsorship amount

Optional:

- preferred content types
- blocked domains
- wallet public address

Advanced policy belongs in `/creator/settings/agent`. Do not claim social analysis unless ingestion occurred.

## Brand Dashboard

Summary:

- active Promotions
- negotiations in progress
- Agreements
- locked escrow amount

Sections:

- Active Promotions
- Recent Agent Activity
- Contracted Creators

CTA: Create your first/new Promotion.

## Creator Dashboard

Summary:

- new offers
- Agent negotiations
- active sponsorships
- pending payout

Sections:

- Offers
- Active Sponsorships
- Recent Agent Activity

Primary actions: Agent criteria and receive-offers toggle. Creator does not manually add sponsorship.

## Query rules

- no hardcoded UID
- no global latest Promotion
- authenticated ownership/participation filters
- stable sort by `updatedAt desc`
- bounded results and pagination where needed
- loading, empty, error states
- refresh restores state
