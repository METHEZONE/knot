# KNOT ExecPlan Rules

Every non-trivial phase must have one self-contained ExecPlan in `.agent/execplans/<phase-name>.md`.

## Required sections

```markdown
# Title
## Goal
## Current Behavior
## In Scope
## Out of Scope
## Files and Symbols
## Data Migration
## API Changes
## UI Changes
## Security Considerations
## Milestones
## Tests
## Rollback
## Progress
## Decisions
## Risks
## Completion Evidence
```

- Record exact file paths after repository inspection.
- Do not invent directories or commands.
- A phase may not silently expand into the next phase.
- Destructive migration requires backup and rollback.
- Deployment and on-chain execution require user approval.
- Use `[ ]`, `[~]`, `[x]`, `[!]` for progress.
