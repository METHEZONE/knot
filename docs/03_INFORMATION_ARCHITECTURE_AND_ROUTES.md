# Information Architecture and Routes

## Principle

Routes are based on business resources, not demo steps.

Do not model the product as `/negotiate → /result → /settlement`. Model it as `Promotion → Agreement`.

## Target routes

```text
/
/login
/signup
/auth/callback
/logout
/onboarding/role
/brand/onboarding
/creator/onboarding

/brand
/brand/promotions/new
/brand/promotions/{promotionId}
/brand/agreements/{agreementId}
/brand/settings/profile
/brand/settings/agent

/creator
/creator/offers/{negotiationId}
/creator/agreements/{agreementId}
/creator/settings/profile
/creator/settings/agent

/dev/admin
```

## Guards

- Unauthenticated protected access → `/login?next=...`
- No role → `/onboarding/role`
- Brand profile incomplete → `/brand/onboarding`
- Creator profile incomplete → `/creator/onboarding`
- Completed Brand → `/brand`
- Completed Creator → `/creator`
- Wrong role → backend 403, frontend role root
- Admin route → verified admin claim or strict server allowlist

## Legacy redirects

```text
/brand/products/new      → /brand/promotions/new
/brand/negotiate         → last active Promotion or /brand
/brand/result            → last Agreement or /brand
/brand/settlement        → last Agreement or /brand
/creator/result          → /creator
/creator/brands/glow-bar → resolved Agreement or /creator
/creator/criteria        → /creator/settings/agent
```

Legacy page implementations must not remain as parallel sources.

## Navigation

Brand: Dashboard, Promotions, Agreements, Settings. CTA: New Promotion.

Creator: Dashboard, Offers, Agreements, Settings. Primary action: receive sponsorships toggle and Agent criteria.
