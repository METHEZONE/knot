# ExecPlan 34 - Gemini Negotiation Chat Copy

Date: 2026-08-20 KST

## Goal

Make the visible A2A negotiation chat feel smoother by using Gemini/Vertex AI for
user-facing negotiation copy while preserving deterministic policy authority.

## Scope

- Add a Gemini-backed Brand Agent chat display generator.
- Keep OFFER, COUNTER, ACCEPT amounts and actions fixed by policy code.
- Store message provider/model/fallback metadata in the display payload.
- Add prompt style examples for practical OFFER/COUNTER/ACCEPT chat output.
- Render only the visible chat message in Negotiation Detail instead of appending
  internal rationale to the bubble text.
- Preserve deterministic fallback when Gemini is off or unavailable.
- Add targeted tests for Brand Agent display generation.

## Non-Goals

- Do not let Gemini authorize payment, escrow, settlement, or policy decisions.
- Do not expose private brand or creator policy thresholds.
- Do not change A2A protocol decisions or negotiation amounts.
- Do not deploy or mutate Firestore in this phase.

## Verification

- `./.venv/bin/python -m ruff check backend/libs/ai/gemini.py backend/apps/api/routes.py backend/tests/test_api_promotions.py`
- Targeted pytest for Brand/Creator negotiation copy.
