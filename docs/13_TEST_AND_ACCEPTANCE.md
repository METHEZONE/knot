# Test and Acceptance Plan

## Auth

Google sign-in, invalid token rejection, first-login bootstrap, refresh, role guard, wrong-role 403, no local-demo fallback.

## Onboarding

Brand/Creator one-page submit, category multi-select + custom, validation, idempotency, redirect, refresh persistence.

## Dashboards

Ownership queries, empty state, multiple records, activity, no global latest leakage, responsive layout.

## Routes

Dynamic Promotion/Agreement, 404, 403, legacy redirect.

## A2A

Actual HTTP, server Task, multi-turn, Artifact, duplicate message, terminal state, private isolation.

## Escrow

termsHash, lock/release idempotency, confirmed signatures, recipient validation, evidence gate, failure persistence.

## Dev admin

Non-admin rejection, user list, disable/enable, deletion dry run, confirmation, deletion job, funded-record retention, audit, scoped reset, retry authorization.

## Full E2E

```text
Brand login → onboarding → dashboard → Promotion → Agent run → Agreement → escrow lock
Creator login → onboarding → dashboard → Agreement → evidence → release
Admin → inspect accounts → delete disposable test user → verify auth and Firestore effects
```

Record redacted UID, resource IDs, signatures, commands, and deployment revision.
