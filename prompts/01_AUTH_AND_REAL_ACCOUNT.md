# Phase 1 — Firebase Auth and Real Account Context

Read `AGENTS.md`, active ExecPlan, and docs 04, 06, 07, 11, 13.

Goal: replace local-demo account context in API mode with verified Firebase Auth and real `users/{uid}` data.

Requirements:

- Firebase client sign-in
- backend ID token verification
- `GET /api/v1/me`
- idempotent user bootstrap
- route guards from backend context
- no frontend UID trust
- no demo fallback
- explicit emulator mode
- loading/error/unauthenticated states
- tests

Do not implement dashboards beyond minimal routing placeholders. Do not deploy or change secrets without approval.
