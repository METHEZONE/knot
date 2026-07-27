# Firebase Auth Setup

KNOT MVP frontend uses Firebase Authentication for browser login. The Firebase web
configuration is public build configuration, but it must match the active Firebase
project and every browser hostname must be authorized in Firebase Console.

## Console Checklist

1. Open Firebase Console and select the same project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
2. Go to `Authentication`.
3. Enable Authentication if it is not already enabled.
4. Open `Sign-in method`.
5. Enable `Google` provider.
6. Open `Authentication > Settings > Authorized domains`.
7. Add local development hostnames such as `localhost` when using local dev.
8. Add deployed hostnames for Cloud Run, Firebase Hosting, Vercel, or a custom domain.
9. If both `www.example.com` and `example.com` are used, add both hostnames.
10. Add only the hostname. Do not include protocol or path.
11. Restart the frontend dev server or rebuild the frontend after environment variable changes.

## Required Public Environment Variables

These values are injected into the Next.js frontend build/runtime and must come
from the Firebase Web App configuration:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

KNOT MVP does not initialize Firebase Analytics. Authentication is the only
required Firebase browser SDK feature.

## Error Reference

- `auth/unauthorized-domain`: add the current browser hostname to Firebase
  Authentication authorized domains.
- `auth/popup-closed-by-user`: retry login after keeping the Google popup open.
- `auth/popup-blocked`: allow popups for the current hostname.
- `auth/network-request-failed`: check network connectivity and Firebase service access.

When `auth/unauthorized-domain` occurs in development, the frontend logs the
hostname that must be added to Firebase Console. It does not print secrets.
