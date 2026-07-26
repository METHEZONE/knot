# Phase 0 — Repository Audit and Reboot Plan

Read `AGENTS.md`, `PLANS.md`, and docs 00, 01, 02, 03, 12, 13.

Do not edit application code until the audit is complete.

Tasks:

1. Map actual repository structure.
2. Identify auth/session implementation.
3. Find all mock, fixture, hardcoded ID, timer, and fallback-success paths.
4. Map current routes and reusable visual components.
5. Map Firestore ownership and missing fields.
6. Classify files as KEEP, ADAPT, REPLACE, REMOVE_AFTER_CUTOVER, ARCHIVE_DOC.
7. Locate actual A2A and escrow code.
8. Archive conflicting old documents.
9. Create `.agent/execplans/00-reboot-audit.md`.
10. Create `docs/IMPLEMENTATION_STATUS.md`.

Use up to two read-only subagents for frontend and backend inventory. Do not deploy, delete data, change secrets, or implement features.
