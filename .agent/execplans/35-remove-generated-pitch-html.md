# ExecPlan 35 - Remove Generated Pitch HTML

Date: 2026-08-20 KST

## Goal

Remove the generated local pitch HTML file from the repository after the user
requested that the presentation file be removed.

## Scope

- Delete `frontend/public/pitch/slides.html`.
- Verify no active references to that file remain.

## Non-Goals

- Do not remove product documentation such as `docs/PRESENTATION_HANDOFF_FINAL.md`.
- Do not change deployed services, Firestore, secrets, wallets, pay.sh, or Solana
  state.

## Verification

- Reference search for `slides.html` and `/pitch`.
- `git diff --check`.
