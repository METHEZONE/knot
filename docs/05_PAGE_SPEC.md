# Page Specification

Existing design tokens and reusable components must be preserved.

## `/login`

Google sign-in, auth error, loading, safe redirect.

## `/onboarding/role`

Two role cards and one-time role warning. No product fields.

## `/brand/onboarding`

Compact sections: identity, categories, target, optional restrictions. Reachable submit button. No multi-step vertical stepper.

## `/creator/onboarding`

Creator identity, social references, categories, basic private criteria. No full policy ladder.

## `/brand`

Summary cards, active Promotions, contracted Creators, recent Agent Activity, New Promotion CTA.

## `/brand/promotions/new`

Product name, Promotion title, categories, target, total budget, initial offer, maximum per Creator, auto-accept ceiling, maximum rounds, deliverables, usage rights, deadline, prohibited claims.

## `/brand/promotions/{promotionId}`

Sections or tabs: Overview, Candidates, Agent Activity, Agreement.

State behavior:

- DRAFT: edit/activate
- ACTIVE: run matching
- MATCHING: results
- NEGOTIATING: real A2A timeline
- AGREED: Agreement + Fund Escrow
- ESCROW_LOCKED: collaboration
- FAILED: error and safe retry

## `/brand/agreements/{agreementId}`

Final terms, termsHash, parties, task IDs, escrow, lock receipt, evidence, release receipt.

## `/creator`

Summary, Offers, active sponsorships, Agent Activity, receive-offers toggle.

## `/creator/offers/{negotiationId}`

Public Promotion, sanitized timeline, current terms, approval request if needed. No Brand hard maximum or raw prompt.

## `/creator/agreements/{agreementId}`

Final terms, milestone, evidence submission, payout status, signatures.

## `/dev/admin`

One route with Overview, Users, Commerce, Agents & A2A, Escrow, Audit tabs.

Every data page requires loading, empty, recoverable error, forbidden, not found, terminal failure, and idempotent retry where safe.
