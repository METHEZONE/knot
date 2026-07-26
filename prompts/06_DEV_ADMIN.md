# Phase 6 — Protected `/dev/admin`

Read `AGENTS.md`, active ExecPlan, and docs 06, 07, 10, 11, 13.

Goal: one protected dev admin route and API.

Minimum:

- overview
- user search/detail
- disable/enable
- deletion dry run
- deletion job
- Firebase Auth deletion
- Firestore dependency handling
- financial/audit retention
- audit events
- demo seed/reset by seedBatchId
- non-admin rejection

Do not implement arbitrary status editing or global deletion. Destructive testing requires a disposable account and explicit approval.
