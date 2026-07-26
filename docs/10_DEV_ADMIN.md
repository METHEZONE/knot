# `/dev/admin` Specification

## Purpose

One protected development operations route for test data management and MVP diagnosis. It is not a public production admin product.

## Access

Requires verified Firebase token and `admin: true` custom claim or strict server-side allowlist in non-production.

```text
KNOT_DEV_ADMIN_ENABLED=false  # production default
```

## Tabs

- Overview: readiness, environment, counts, latest failures
- Users: account/profile/Agent status, disable, enable, delete
- Commerce: Promotions, Match Runs, Negotiations, Agreements, Evidence
- Agents & A2A: Agent registry, Tasks, messages, failures, traces
- Escrow: state, amount, signatures, safe retry
- Audit: admin actions, deletion jobs, actor, result

## Account deletion

Deletion is a job:

```text
Admin types exact email/UID
→ verify admin
→ create deletionJob
→ disable Firebase Auth user
→ mark user DELETION_PENDING
→ inventory dependencies
→ delete safe records
→ retain financial/audit records when required
→ delete Firebase Auth user
→ complete job
→ audit event
```

## Safety

May delete incomplete profile, draft Agent, unfunded draft Promotion, and disposable demo negotiation records.

Must not blindly delete confirmed escrow receipts, released payouts, or audit events. Retained records should minimize personal projection.

## Demo seed/reset

Only records tagged with `seedBatchId` or demo environment. Dry run and confirmation are required. Never global-delete collections.

## Retry

Only known retryable, idempotency-protected operations. No arbitrary status editor.
