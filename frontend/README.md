# KNOT Frontend

Next.js App Router + TypeScript frontend for the stripped-down KNOT MVP demo.

The app is built for Google Cloud Run. Other preview hosts are not deployment
targets for this repository.

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Core demo routes:

```text
/
/creator/onboarding
/creator/offers
/creator/negotiate
/creator/result
/creator/milestones
/brand/onboarding
/brand/matching
/brand/negotiate
/brand/result
/brand/settlement
```

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
