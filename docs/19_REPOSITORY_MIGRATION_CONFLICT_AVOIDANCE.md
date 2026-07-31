# Repository Migration and Conflict Avoidance

## 1. Goal

Apply the final product behavior to the existing KNOT code without losing current design assets, working API/server behavior, authentication, A2A, Web3, deployment configuration, or recoverability.

## 2. Do not begin with merge/rewrite

Forbidden first actions:

- wholesale merge of a UI branch into stable base;
- deleting existing `docs`, routes, API clients or collections without audit;
- replacing backend schemas to match a prototype;
- renaming all endpoints/fields in one commit;
- moving services solely to match a new folder diagram;
- editing main directly.

## 3. Establish safe Git state

```bash
git fetch --all --prune
git status --short
git branch -a
git remote -v
git log --oneline --decorate --graph --all -n 100
```

Identify:

```text
STABLE_BASE
DEPLOYED_COMMIT
UI_REFERENCE_BRANCH_OR_COMMIT
```

Create a backup tag/branch and a new worktree:

```bash
git branch backup/pre-final-knot-$(date +%Y%m%d) <STABLE_BASE>
git worktree add ../knot-final -b feat/final-agentic-matching-flow <STABLE_BASE>
cd ../knot-final
```

If the branch exists, inspect it; never overwrite uncommitted work.

## 4. Audit artifacts

Before changes, create:

```text
docs/INTEGRATION_AUDIT.md
docs/API_COMPATIBILITY_MATRIX.md
docs/FIRESTORE_MIGRATION_PLAN.md
artifacts/reference-ui/
```

Audit table:

| Area | Existing source | Working? | Deployed? | Preserve/Adapt/Replace | Evidence |
|---|---|---:|---:|---|---|
| Auth | | | | | |
| Brand onboarding | | | | | |
| Creator onboarding | | | | | |
| Dashboard | | | | | |
| API client/proxy | | | | | |
| Profile analysis | | | | | |
| Matching | | | | | |
| A2A | | | | | |
| Agreement | | | | | |
| Escrow/release | | | | | |
| Firestore | | | | | |
| Deployment | | | | | |

## 5. Visual design strategy

Source of truth is the existing running KNOT design and current reference components.

- Reuse current card, button, typography, Agent avatar, chat, knot animation and layout components.
- Change state/data wiring before changing visual markup.
- Wrap branch-specific types with ViewModels.
- Port individual components with Git history where needed; do not merge the entire branch.
- Store reference screenshots before and after.
- Avoid CSS/token churn unrelated to final behavior.

## 6. Frontend integration pattern

```text
Existing visual component
→ feature ViewModel hook
→ live adapter
→ typed existing/additive API client
```

Suggested additive directories only if compatible with current layout:

```text
frontend/src/infrastructure/api
frontend/src/infrastructure/realtime
frontend/src/infrastructure/auth
frontend/src/infrastructure/wallet
frontend/src/adapters/onboarding
frontend/src/adapters/dashboard
frontend/src/adapters/matchRuns
frontend/src/adapters/negotiations
frontend/src/adapters/agreements
frontend/src/adapters/escrow
```

Do not duplicate existing modules with slightly different names if they already provide this role.

## 7. API preservation

For each UI action, map:

| UI action | Existing component | Existing endpoint | Canonical operation | Adapter/change | Compatibility test |
|---|---|---|---|---|---|

Rules:

- maintain old endpoint while new client transitions;
- add optional fields rather than breaking required fields;
- use aliases for route nomenclature;
- no production mock fallback;
- explicit 202 async semantics where added;
- generated/openapi clients updated with contract tests.

## 8. Firestore migration

- Inventory actual collections and indexes.
- Map legacy to canonical fields.
- Add new projection collections rather than overloading private profile documents.
- Write idempotent backfill script.
- Dry run and log counts only—not sensitive values.
- Dual-read during transition.
- New writes populate canonical fields and, if needed, legacy compatibility fields.
- Verify queries/indexes before switching frontend.
- Do not drop old data in hackathon refactor.

## 9. Service preservation

- Keep stable Product API/A2A/Web3 services deployable at every phase.
- Add internal interfaces around existing implementations before replacing behavior.
- Reuse current async mechanism if verified.
- Do not change region/project/ingress/IAM unintentionally.
- Preserve `healthz/readyz` and deployment scripts.
- Record environment/config differences.

## 10. Mock removal strategy

Identify every fixture/mock source:

```bash
rg -n "mock|fixture|fake|simulated|demoMode|setTimeout" frontend backend web3
```

Classify:

- Storybook/test fixture: keep;
- explicit `DEMO_MODE`: keep with clear badge;
- live API silent fallback: remove;
- timer-driven business transition: replace with event state;
- fake hash/signature/Explorer: remove immediately from live path.

## 11. Safe cleanup

Unused legacy code is deleted only after:

- canonical flow is verified;
- no imports/references/routes/tests depend on it;
- compatibility redirect exists if needed;
- commit is isolated;
- rollback remains possible.

Do not mix cleanup with functional migration commits.

## 12. Rollback

Each deploy:

- references commit SHA;
- preserves previous Cloud Run revision;
- documents migration/backfill version;
- uses additive schema;
- can revert frontend/API independently where contracts remain compatible.

If a migration cannot roll back, document why and do not execute it without explicit review.

## 13. Docs replacement

Back up old docs through Git history/branch; avoid keeping conflicting active source-of-truth files in the same `docs` root.

Suggested:

```bash
git checkout -b chore/install-knot-final-docs
mkdir -p _docs_backup
cp -R docs _docs_backup/docs-before-final
rm -rf docs
cp -R <bundle>/docs ./docs
cp <bundle>/KNOT_PRODUCT_MASTER_SPEC_FINAL.md ./docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md
```

Keeping `_docs_backup` in Git is optional; a backup branch/tag is usually cleaner. Do not accidentally delete repository-specific runbooks that are still operational—merge those into the new index after audit.

## 14. Completion report

Codex final report must include:

- branch and commits;
- files changed by subsystem;
- preserved endpoints/services;
- new endpoints/schema/indexes;
- migrations executed;
- tests and exact commands/results;
- deployed Cloud Run revisions/URLs;
- actual A2A IDs and devnet signatures;
- blockers with evidence;
- known limitations;
- rollback instructions.
