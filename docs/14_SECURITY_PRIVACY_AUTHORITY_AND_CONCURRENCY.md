# Security, Privacy, Authority and Concurrency

## 1. Security model

KNOT handles private negotiation limits and transaction authority. Security boundaries must be explicit:

```text
Frontend
→ authenticated Product API
→ authorized application services
→ service-authenticated A2A/worker/Web3 services
→ allowlisted external/on-chain operations
```

No browser-only role flag, hidden field, or UI condition is a security boundary.

## 2. Identity and ownership

- Verify the current production authentication mechanism server-side.
- Firebase ID token is preferred where already integrated.
- Resolve role, profile, and resource ownership from backend state.
- A Brand cannot access another Brand’s Promotion/run/policy.
- A Creator cannot access another Creator’s private policy or settlement destination.
- Cross-owner IDs return 403 or privacy-preserving 404 according to existing API convention.
- Admin access requires verified server-side claims or strict allowlist.

## 3. Private policy boundary

Private data includes:

### Brand-only

- target and hard maximum amount;
- internal approval/acceptance rules;
- paid verification spend cap and wallet authority;
- internal candidate score notes.

### Creator-only

- exact target and absolute minimum amount;
- blocked categories;
- minimum lead time when private;
- private notes and willingness rules.

### System-only

- raw prompts/model responses;
- policy snapshots;
- credentials;
- retry metadata;
- signing material;
- full external data results when licensing/privacy limits apply.

Counterparty DTOs contain only offers/counters, public terms, sanitized rationale, and outcomes. Do not return a full private object and hide fields in the frontend.

## 4. URL analysis and SSRF defense

Product/profile/evidence URL fetchers must implement:

- `https` scheme allowlist unless a documented test mode is used;
- supported domain policy where applicable;
- reject localhost, loopback, private, link-local, metadata and reserved IP ranges;
- DNS resolution and rebinding protection;
- redirect count and redirect target validation;
- timeout and response size limits;
- MIME/content-type validation;
- no browser script execution;
- HTML sanitization;
- compressed payload limits;
- rate limits by user/source;
- safe user agent and outbound egress policy;
- audit reason codes without logging sensitive content.

## 5. Prompt-injection defense

- Treat fetched content as untrusted data.
- System and developer instructions are not derived from source text.
- Use structured output schemas.
- Tell the model to ignore instructions inside external content.
- Never put secrets, private keys, service tokens, or full private policies in model context unless strictly required; prefer derived bounded values.
- Validate all model output deterministically.
- Do not store chain-of-thought.
- Store only structured output, a concise decision summary, model/prompt versions, and safe usage metadata.

## 6. Agent authority

Authority is separate from policy.

```text
Policy
= what terms are acceptable

Authority
= what actions the Agent may execute
```

Authority checks happen immediately before sensitive operations, even if the Agent previously decided to act.

Sensitive actions:

- external paid API purchase;
- Agreement acceptance if signature/mandate semantics apply;
- escrow lock;
- settlement release;
- cancellation/refund.

Each action checks:

- owner/agent state;
- capability flag;
- scope and resource binding;
- per-operation limit;
- per-run/daily aggregate limit;
- current balance;
- idempotency;
- expiry/version;
- network/tool/program allowlist.

## 7. Wallet and signing secrets

- Never expose private key, seed, mnemonic, raw secret, or service-account key file in source, docs, logs, fixtures, screenshots or frontend env.
- Prefer managed identity and Secret Manager/KMS-compatible patterns used by the current repository.
- `NEXT_PUBLIC_*` contains no signing secret.
- Web3 Gateway accepts a domain operation, not an arbitrary user-supplied transaction payload.
- Allowed program, mint, recipients/rules and network are server-controlled.
- Simulate/validate before submit where supported.

## 8. A2A security

- Trusted Agent Registry/AgentCard source;
- supported protocol version check;
- service-to-service authentication;
- tenant/routing validation;
- Message ID deduplication;
- Task/context binding;
- replay protection;
- body size and rate limit;
- terminal-state immutability;
- sanitized logs;
- correlation IDs;
- no private policy in A2A payloads.

## 9. Creator reservation and race control

A creator can be selected by multiple Brand runs at nearly the same time. Use an atomic reservation lease.

Transaction checks:

```text
publicationStatus == PUBLISHED
acceptingOffers == true
availability allows reservation
activeNegotiations < maxConcurrentNegotiations
activeCollaborations < maxActiveCollaborations
no conflicting unexpired lease
```

Transaction writes:

- reservation document;
- Agent availability/counter update;
- Match Candidate reservation state;
- Negotiation identity.

The lease has owner, generation, expiry, and heartbeat/progress extension. Stale leases are reconciled.

## 10. Policy version race

At negotiation start:

- read current profile/policy/authority versions in one consistent flow;
- store snapshots and version IDs;
- evaluate the entire negotiation against those snapshots;
- new user settings affect only future negotiations;
- before payment, revalidate authority and non-negotiable security constraints, but do not silently alter agreed business terms.

## 11. Data retention

Suggested categories:

- canonical Agreement/on-chain receipts: retained for audit/demo/business requirements;
- A2A public messages/events: retained with Agreement/run;
- private policy snapshots: access-restricted, retention documented;
- raw source content: minimize; store digest/derived facts where possible;
- model raw output: minimize and expire; structured result remains;
- temporary fetch/cache: short TTL;
- failed job payloads: redact and expire.

Codex must align retention with existing repository/cloud policies rather than inventing an unsupported deletion system.

## 12. Logging and observability privacy

Log:

- correlation ID;
- resource IDs safe for internal logs;
- event/state;
- latency;
- retry count;
- error code;
- transaction signature after submission;
- model/tool version and safe usage totals.

Redact:

- tokens/cookies;
- private thresholds;
- blocked categories where sensitive;
- raw prompts/source content;
- wallet signing material;
- service account data;
- full personal social profile data.

## 13. Abuse and cost controls

- per-user URL analysis rate limit;
- duplicate URL result reuse by digest/version;
- max active Match Runs;
- max candidates and rounds;
- paid verification caps;
- external tool allowlist;
- run cancellation and queue limits;
- malformed/oversized A2A protection;
- idempotent on-chain operations;
- budget alerting.

## 14. Security acceptance criteria

- unauthorized cross-user resource access fails;
- counterparty DTO contains no exact private threshold;
- SSRF test cases fail closed;
- prompt-injection fixture cannot alter tool/payment authority;
- duplicate run/message/lock/release does not duplicate effects;
- reservation concurrency test produces at most one winner in MVP;
- normal user cannot access `/dev/admin` data;
- repository secret scan is clean;
- no mainnet key/network is used in final hackathon path;
- live mode cannot produce a fake transaction receipt.
