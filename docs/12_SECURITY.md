# KNOT v1 Security Requirements

## 1. Threat priorities

1. Private-key or service credential leakage
2. LLM causing unauthorized payment
3. A2A tenant or task confusion
4. Duplicate transaction execution
5. Cross-user Firestore access
6. Prompt injection from creator content or URLs
7. Log leakage and overly broad IAM

## 2. Identity and authorization

- Browser authenticates with Firebase Authentication.
- API verifies issuer, audience, signature and expiration.
- API derives brand/user identity from token, not request body.
- Private Cloud Run services require IAM invocation using service identity tokens.
- A2A server validates bearer identity and the advertised tenant.
- Authorization is resource-based: caller must belong to the Promotion's brand or be an allowed internal service.

## 3. Secrets

Never commit or print:

- `.env` values
- Google service-account JSON
- Solana keypairs, seed phrases or raw secret arrays
- pay.sh/API tokens
- Firebase admin credentials

Use Secret Manager references and workload identities. Public Firebase web configuration is not an admin secret but should still be environment-configured.

## 4. LLM safety

- Treat fetched posts, profile text and rationale as untrusted data, not system instructions.
- Separate content from instructions in prompts.
- Use allowlisted tools and typed arguments.
- Apply URL scheme and domain safety checks.
- Set fetch size/time limits.
- Model output must pass schema and policy validation.
- Private keys and signing APIs are never model tools.

## 5. A2A controls

- `A2A-Version` required.
- `tenant` must match selected AgentCard.
- `taskId` and `contextId` consistency enforced.
- `messageId` unique and idempotent.
- Terminal tasks reject new messages.
- Rate limit by service identity, brand and creator agent.
- Persist raw protocol payload only after size and schema validation.

## 6. Payment controls

- Web3 service is private.
- All actions are idempotent and state-checked.
- Program ID, cluster, mint and RPC are allowlisted by deployment configuration.
- Simulate before submitting.
- Verify expected recipient and amount after building transaction.
- Never accept arbitrary instruction data from the frontend.

## 7. Data protection

- Store only demo/minimum profile data.
- Avoid scraping or onboarding data in v1.
- Do not store access tokens in Firestore.
- Audit log fields exclude secrets and full prompt bodies.
- Evidence snapshots in Cloud Storage use private access and retention limits.

## 8. Git checks

CI must fail on likely secrets using a secret scanner. Add patterns for Solana JSON keypairs and common Google private-key headers.
