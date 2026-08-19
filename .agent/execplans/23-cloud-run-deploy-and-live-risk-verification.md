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

1. [ ] Commit the deployable source state locally so Cloud Run image tags identify the deployed code.
2. [ ] Deploy existing Cloud Run demo services using `scripts/deploy_cloud_run_demo.sh`.
3. [ ] Smoke test public Web routes and service `/readyz` URLs.
4. [ ] Smoke test authenticated Brand and Creator API paths through API and Web proxy.
5. [ ] Verify `POST /api/v1/brand/promotions/{promotion_id}/agent-run` exists on the deployment.
6. [x] Fix deployed Agent run 500 caused by missing Firestore composite discovery index by adding a real-document deterministic fallback.
7. [ ] Run a deployed Agent run against a safe demo Promotion only if it does not require wallet funding or an on-chain transaction.
8. [ ] Verify deployed negotiation messages include pay.sh `VERIFICATION_EVENT` when the MatchRun records a settled receipt.
9. [ ] Re-check existing devnet funding/release signatures as read-only proof.
10. [ ] Update `docs/IMPLEMENTATION_STATUS.md` with exact live results.

## Non-goals

- No IAM or Secret Manager changes.
- No wallet funding.
- No Solana program deployment or upgrade.
- No new on-chain funding/release transaction without separate approval.
