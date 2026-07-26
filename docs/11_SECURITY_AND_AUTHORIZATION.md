# Security and Authorization

## Trust boundaries

Browser is untrusted for UID, role, ownership, payment authorization, and admin authorization.

Product API verifies identity and ownership. Creator A2A verifies service identity, tenant, schema, and task context. Web3 Gateway revalidates payment mandate and signs.

## Firebase

Verify ID token server-side. Never accept frontend `userId` as proof.

## Ownership

Brand mutates only its profile, Promotions, and funding actions. Creator mutates only its profile, policy, approvals, and evidence. Both can read shared Agreement projections but not the other party's private policy.

## Admin

Custom claim or server allowlist, backend enforcement, destructive confirmation, audit log.

## A2A

Service auth, tenant validation, schema and enum allowlist, size limits, URL validation, duplicate protection, external text treated as data.

## LLM

Structured output, schema validation, limited retry, no secrets, no chain-of-thought persistence, no payment authorization.

## Deletion

Disable auth before destructive work. Use deletion jobs and partial-failure recovery.

## Logging

Log IDs, transitions, policy check codes, model/prompt version, latency, signatures, and admin actions. Do not log ID/access tokens, private keys, seed phrases, or raw chain-of-thought.
