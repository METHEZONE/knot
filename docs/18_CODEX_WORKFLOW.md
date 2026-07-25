# Codex Workflow for KNOT

## 1. Keep the documentation in the repository

Codex reads `AGENTS.md` before work. Core guidance must therefore be committed. Do not paste the entire documentation pack into every prompt; reference repository files.

## 2. Session pattern

1. Pull latest main branch.
2. Create one branch/worktree for one bounded task.
3. Ask Codex to inspect `AGENTS.md` and relevant docs.
4. Require a brief plan and list of intended files before edits.
5. Let it implement only the specified milestone.
6. Require tests and exact output.
7. Review diff, especially schemas, IAM, secrets and transaction logic.
8. Merge only after docs/status are updated.

## 3. Prompt composition

A good task includes:

- goal and user-visible result
- exact scope and exclusions
- source-of-truth docs
- acceptance criteria
- test commands
- files/services it may touch
- no-go constraints

Use an external task prompt template when useful, but do not commit prompt files unless explicitly requested.

## 4. Parallel Codex agents

Safe parallel tracks:

- frontend with frozen API fixtures
- policy/matching backend
- Creator A2A server
- web3 gateway/program
- Terraform/Cloud Build

Avoid parallel edits to shared domain schemas. Assign one owner/branch to schema changes and merge them first.

## 5. Review priorities

Review generated code manually for:

- secrets or overly broad IAM
- mismatch between Firestore/API/A2A/on-chain field names
- missing idempotency
- model output directly triggering payment
- in-process Cloud Run background work
- unbounded retries or negotiation loops
- fake/mock transaction paths accidentally used in final demo

## 6. Living memory

At task completion, update `docs/20_IMPLEMENTATION_STATUS.md` with:

- completed milestone
- changed contracts
- commands run and result
- deployed revision if any
- remaining issue

This is more reliable than relying on chat history.
