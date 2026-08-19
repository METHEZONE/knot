# ExecPlan 23 - Cloud Run Deploy and Live Risk Verification

## Scope

Deploy the verified final-demo risk tightening changes to the existing Cloud Run demo services, then verify the deployed links against the judging risks:

- Service readiness and route rendering.
- Authenticated Brand and Creator API paths.
- Server-side Brand Agent run endpoint availability.
- pay.sh sandbox verification through the deployed API path.
- Existing Solana devnet escrow proof remains finalized.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`
- `docs/15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md`
- `docs/16_TEST_ACCEPTANCE_AND_DEMO.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Preconditions Verified

- User approved Cloud Run deployment in chat.
- No approval was given for IAM/Secret changes, wallet funding, program deployment, or new on-chain transactions.
- Existing `KNOT_SETTLEMENT_AUTHORITY` is reused from the current Cloud Run API environment.
- Demo deploy script defaults `PAYSH_RESOURCE_ID` to the pay.sh sandbox debugger quote endpoint and sets min instances for demo latency.
- Local tests passed before deployment:
  - `./.venv/bin/python -m ruff check backend/libs/payments/paysh.py backend/apps/api/routes.py backend/tests/test_api_promotions.py`
  - `bash -n scripts/deploy_cloud_run_demo.sh`
  - `npx -y @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL`
  - `./.venv/bin/pytest backend/tests/test_api_promotions.py::test_run_match_pays_a_real_paysh_sandbox_call -q -rs`
  - `./.venv/bin/pytest backend/tests -q`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend test -- --runInBand`
  - `npm --prefix frontend run build`

## Implementation Steps

1. [x] Commit the deployable source state locally so Cloud Run image tags identify the deployed code.
2. [x] Deploy existing Cloud Run demo services using `scripts/deploy_cloud_run_demo.sh`.
3. [x] Smoke test public Web routes and service `/readyz` URLs.
4. [x] Smoke test authenticated Brand and Creator API paths through API and Web proxy.
5. [x] Verify `POST /api/v1/brand/promotions/{promotion_id}/agent-run` exists on the deployment.
6. [x] Fix deployed Agent run 500 caused by missing Firestore composite discovery index by adding a real-document deterministic fallback.
7. [x] Fix deployed pay.sh runtime failure caused by the API image missing `curl` for the native pay binary install path.
8. [x] Run a deployed Agent run against a safe demo Promotion only if it does not require wallet funding or an on-chain transaction.
9. [x] Verify deployed negotiation messages include pay.sh `VERIFICATION_EVENT` when the MatchRun records a settled receipt.
10. [x] Re-check existing devnet funding/release signatures as read-only proof.
11. [x] Update `docs/IMPLEMENTATION_STATUS.md` with exact live results.

## Live Results

- `knot-api` now serves revision `knot-api-00023-d7n` at 100% traffic with image
  `us-central1-docker.pkg.dev/knot-dev-503505/knot/knot-api:96616ca`.
- API env confirmed `PAYSH_MODE=sandbox` and
  `PAYSH_RESOURCE_ID=https://debugger.pay.sh/mpp/quote/AAPL`.
- `/readyz` returned 200 for deployed API, Web3 Gateway, and Creator Agent.
- Public deployed Web routes returned 200 for login, Brand dashboard/promotion/
  negotiation pages, and Creator dashboard/offers/agreements/settlements pages.
- No-auth `agent-run` with an idempotency key returned 401 through both API and
  Web proxy, proving the route exists and still requires Firebase auth.
- Authenticated Brand `agent-run` on `promotion-xexymix-devnet` returned 201:
  - `matchRunId=match-11fa1c95-3840-48fe-a7e0-10184bb6ed46`
  - `paidStatus=SETTLED`
  - `receiptId=receipt-paysh-c345a5b4-3001-5fe4-952f-d0c941dc0ebe`
  - `negotiationId=negotiation-52aa022e-03e4-4460-ab5f-7a61a455d1df`
  - `agreementId=agreement-6fa1f7cd-2d13-42b7-b097-063d9118ef49`
- Deployed Web proxy returned a `SYSTEM` `VERIFICATION_EVENT` for that
  negotiation with `provider=pay.sh`, `status=SETTLED`, and display message
  `후보 검증 API를 사용했어요. 0.02 USDC · 결제 완료`.
- Authenticated Brand API paths returned 200 for `/me`, dashboard, promotion
  detail, agreement detail, and negotiation detail.
- Authenticated Creator API paths returned 200 for `/me`, dashboard, offers,
  the new offer detail, and agreements.
- Existing devnet funding and release signatures both confirmed `Finalized`.
- Devnet programs `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj` and
  `9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn` were readable as executable
  program accounts.
- No Secret Manager change, wallet funding, program deployment, or new on-chain
  transaction was performed in this phase.

## Final Verification

- `./.venv/bin/python -m ruff check backend/libs/payments/paysh.py backend/apps/api/routes.py backend/libs/agents/discovery.py backend/tests/test_creator_discovery.py backend/tests/test_api_promotions.py`: passed.
- `./.venv/bin/pytest backend/tests/test_creator_discovery.py backend/tests/test_api_promotions.py::test_brand_agent_run_starts_a2a_and_projects_paysh_message backend/tests/test_api_promotions.py::test_run_match_pays_a_real_paysh_sandbox_call -q -rs`: 4 passed.
- `./.venv/bin/pytest backend/tests -q`: 168 passed, 6 skipped.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run test`: 21 passed.
- `npm --prefix frontend run build`: passed.
- `bash -n scripts/deploy_cloud_run_demo.sh`: passed.

## Non-goals

- No IAM or Secret Manager changes.
- No wallet funding.
- No Solana program deployment or upgrade.
- No new on-chain funding/release transaction without separate approval.
