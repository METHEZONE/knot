# Codex Execution Guide

Do not send one giant implementation request. Use one phase per session and one writer.

## Session pattern

```text
Plan mode
→ read phase prompt
→ inspect repository
→ create ExecPlan
→ approve
→ implement one milestone
→ test
→ review
→ update plan
→ stop
```

## Context discipline

Read only phase-required docs. End each session with a compact handoff: Completed, Changed files, Commands, Blockers, Next milestone, Decisions.

## Parallelism

Safe: frontend inventory, backend ownership inventory, A2A review, security review, test execution.

Unsafe early: changing auth contracts, Firestore ownership, routes, and Agreement schema in parallel.

## Approvals

Stop before deploy, IAM, Secret Manager, destructive deletion, Firebase user deletion outside disposable tests, wallet funding, on-chain transaction, program deployment, push/merge.
