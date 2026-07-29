# Firebase Auth Setup

## 1. Web App

환경 변수:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

API key는 Firebase web config 특성상 클라이언트에 존재하지만, Security Rules와 backend authorization이 보안 경계다.

---

## 2. Authorized Domains

- localhost
- Cloud Run custom/default domain
- preview domain if used

`auth/unauthorized-domain` 발생 시 Console에서 추가.

---

## 3. Persistence

two-window demo:

```ts
await setPersistence(auth, browserSessionPersistence);
```

Sign-in 전에 적용한다.

검증:
- tab A Brand
- tab B Creator
- refresh 유지
- tab close 후 session 종료
- logout only current tab

---

## 4. Backend

- Firebase Admin SDK
- ID Token verify
- project/audience
- role from Firestore/backend
- token claims alone에 모든 profile data를 넣지 않음

---

## 5. Role Bootstrap

Signup:
1. Firebase user
2. backend user document
3. role
4. onboarding state

Duplicate safe.

---

## 6. Emulator

- Firebase Auth Emulator
- Firestore Emulator
- no production credentials in local test

---

## 7. Test Account Secrets

실제 비밀번호를 repo에 커밋하지 않는다.

```text
E2E_BRAND_EMAIL
E2E_BRAND_PASSWORD
E2E_CREATOR_EMAIL
E2E_CREATOR_PASSWORD
```

CI Secret 사용.

---

## 8. Common Issues

`unauthorized-domain`:
- authorized domain

무한 `계정 확인 중`:
- auth loading/signed-out 분리
- `onAuthStateChanged` cleanup
- `/me` timeout/error

401:
- token refresh
- bearer header
- backend Firebase project

다른 탭 계정 덮어씀:
- local persistence 제거
- session persistence 확인
