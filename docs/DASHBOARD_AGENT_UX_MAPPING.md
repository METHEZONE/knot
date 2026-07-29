# Dashboard Agent UX Mapping

Last updated: 2026-07-30

## Stable Routes

| Area | Stable route |
|---|---|
| Brand dashboard | `/brand` |
| Creator dashboard | `/creator` |
| Brand Promotion list | `/brand/promotions` |
| Brand Promotion detail | `/brand/promotions/[promotionId]` |
| Brand negotiation detail | `/brand/negotiations/[negotiationId]` |
| Brand Agreement detail | `/brand/agreements/[agreementId]` |
| Creator offers | `/creator/offers` |
| Creator offer detail | `/creator/offers/[negotiationId]` |
| Creator Agreement detail | `/creator/agreements/[agreementId]` |
| Creator settlements | `/creator/settlements` |

## Final Routes For This Pass

| Final route | Implementation |
|---|---|
| `/brand` | Existing dashboard plus Manager card, action list, Agent activity preview |
| `/creator` | Existing dashboard plus Manager card, action list, Agent activity preview |
| `/brand/promotions/[promotionId]/negotiations/[negotiationId]` | Compatibility route to existing negotiation detail |
| `/brand/settings/agent` | Compatibility route to `/brand/settings` |
| `/brand/settlements` | Compatibility route to existing `/brand/settlement` entry |
| `/creator/deals` | Compatibility route to `/creator/agreements` |
| `/creator/deals/[dealId]` | Compatibility route to `/creator/agreements/[dealId]` |
| `/creator/settings/agent` | Compatibility route to `/creator/settings` |

## Prototype Component Mapping

| Prototype component | Visible role | Mock source | Existing live API | Adapter | Final route | Reuse strategy |
|---|---|---|---|---|---|---|
| `features/chat/ManagerChat.tsx` | Brand, Creator | `dealBoard`, `runDeal`, fixed `Glow Agent`/`Mina Agent` | `listNegotiationMessages`, `getNegotiation`, `getNegotiationAgreement`, `getAgreementEscrow` | `mapNegotiationMessagesToActivities` | Negotiation/Offer detail | Recreate conversation UI with live view model; do not import mock board |
| `NegotiationThread` inside `ManagerChat` | Brand, Creator | deterministic frontend rounds | A2A messages and negotiation status | `AgentActivityItem[]` | Detail main column | Port visual language: bubbles, two agents, policy checks |
| `EscrowVault` inside `ManagerChat` | Brand, Creator | mock milestone split and simulated text | Agreement escrow bundle | `mapEscrowActivity` | Detail sidebar and timeline | Recreate as honest escrow summary, no fake signature |
| `features/onboard/CreatorConnect.tsx` | Creator | `lookupInstagram`, `setTimeout`, `dealBoard` | `/me/creator-profile` | Existing onboarding submit | `/creator/onboarding` | Adopt copy and Instagram-first layout; no fake analysis claim |
| `features/onboard/CreatorRules.tsx` | Creator | `setupStore` blocked category labels | Creator policy input | Existing onboarding submit | `/creator/onboarding`, `/creator/settings` | Adopt "두 개만 정하면 끝이에요" and "매니저 붙이기" copy |
| `features/onboard/BrandMood.tsx` | Brand | frontend swipe/mood setup | Brand profile and Promotion APIs | Existing onboarding/create Promotion forms | `/brand/onboarding`, `/brand/promotions/new` | Adopt Manager attachment copy and policy summary, not mock swipe state |
| `features/settings/SettingsScreen.tsx` | Brand, Creator | mock board/profile | `/me`, role settings | `managerFromContext` | Settings and dashboard cards | Reuse Manager card concept only |

## Live Data Mapping

| UI view | Live source | Notes |
|---|---|---|
| Manager card | `CurrentUserContext`, dashboard profile summary, active Promotion/Offer snippets | Agent names derive from profile/account; fixture names are not hardcoded for live users |
| Dashboard Agent preview | `dashboard.recentAgentActivity`, `dashboard.offers`, `dashboard.activePromotions` | Shows 3-5 sanitized items and links to resource details |
| Detail conversation | `ApiNegotiation`, `ApiNegotiationMessage[]`, optional `ApiAgreement`, optional `ApiEscrow` | Raw A2A JSON is hidden under developer details only |
| Agreement card | `ApiAgreement` | Agreement ID and terms hash are distinct |
| Escrow card | `ApiEscrow`, `ApiSettlement[]` | Real signature shown only when returned by API |
| Milestone progress | `agreement.milestones` snapshot or `agreement.terms.milestones` | No fixed 30/70 unless terms actually contain it |
| Next action | Derived from negotiation/agreement/escrow/milestone state | One primary next action per role/status |

## Mock Dependencies To Avoid

- `dealBoard`
- `setupStore`
- `runDeal`
- frontend-generated `termsHashOf`
- fixed `Mina Agent` and `Glow Agent`
- simulated escrow copy outside explicit mock/demo mode
- frontend evidence verification as a production decision

## Files

| File | Action |
|---|---|
| `frontend/src/product/agentExperience.ts` | Add live mappers and view types |
| `frontend/src/product/AgentExperience.tsx` | Add dashboard cards, preview, conversation, sidebar |
| `frontend/src/product/ProductScreens.tsx` | Integrate dashboard and detail components |
| `frontend/src/auth/firebaseClient.ts` | Add per-tab Firebase session persistence |
| `frontend/src/app/**` | Add compatibility routes |
| `frontend/tests/product-flow.test.ts` | Add mapper/session/route tests |

## Boundaries

- Backend, Firestore, A2A, Agreement, Web3, escrow, and settlement logic remain unchanged.
- Browser continues to use Product API and Firebase bearer tokens.
- Production mode does not fall back to mock UI data after live API failure.
- Private counterparty policy values are not rendered.
