# Token Budget Strategy

## Store context in the repository

Do not paste long PRDs repeatedly. Tell Codex to read one phase prompt.

## One phase per session

Audit, Auth, Onboarding/Dashboard, Resource Routes, A2A, Escrow, Dev Admin, Final E2E.

## One writer

Use at most two read-only subagents. Multiple writers on shared contracts cost more tokens through conflicts.

## Compact handoff

Update the active ExecPlan and implementation status. The next session reads those files, not the whole chat.

## Limit scope

No UI redesign, dependency replacement, or infrastructure rewrite unless required.

## Phase-specific tests

Run only related tests until final E2E.

## Stop command

```text
Stop after the current milestone. Update the ExecPlan and handoff. Do not begin the next phase.
```

## Priority under severe limits

```text
Auth → one-page onboarding → real dashboards → resource routes → A2A → escrow → advanced admin
```

Implement basic safe account deletion, but leave advanced admin charts and bulk actions for last.
