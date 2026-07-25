# KNOT Frontend

Next.js App Router + TypeScript frontend for the KNOT product MVP.

The app is built for Google Cloud Run. Other preview hosts are not deployment
targets for this repository.

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Core product routes:

```text
/
/login
/signup
/signup/brand
/signup/creator
/brand/onboarding
/brand/products/new
/brand/negotiate
/brand/result
/brand/settlement
/brand/me
/brand/settings
/creator/onboarding
/creator/criteria
/creator/result
/creator/brands/glow-bar
/creator/me
/creator/settings
/dev/admin
```

Compatibility redirects:

```text
/brand/matching -> /brand/negotiate
/creator/negotiate -> /creator/result
/creator/offers -> /creator/result
/creator/milestones -> /creator/brands/glow-bar
```

The workspace navigation is intentionally menu-like rather than a numbered
stepper. Brand and Creator flows each expose separate product pages for
onboarding, negotiation, results, settlement/milestones, my page, and settings.
Mock data flows through `src/product/dataSource.ts`; replacing it with a
Firestore/API-backed implementation should not require route component changes.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Cloud Run Container

```bash
docker build -t us-central1-docker.pkg.dev/knot-dev-503505/knot/knot-web:local .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  us-central1-docker.pkg.dev/knot-dev-503505/knot/knot-web:local
```

Production Cloud Run config must pass public Firebase values and API base URLs
as environment variables. Do not put service account JSON, API tokens, seed
phrases, private keys, or signer material in `NEXT_PUBLIC_*`.
