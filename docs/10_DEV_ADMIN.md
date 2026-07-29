# Dev/Admin Console

## 1. 목적

일반 사용자에게 protocol complexity를 노출하지 않고 개발·운영자가 Auth, API, A2A, Agreement, Escrow와 배포 상태를 진단한다.

Route:

```text
/dev/admin
/dev/a2a
```

---

## 2. 접근

허용:
- development environment
- ADMIN role
- explicit internal allowlist

금지:
- public navigation
- role card bypass
- query parameter만으로 권한 부여

---

## 3. 표시

### Environment

- environment
- build SHA
- Cloud Run revision
- frontend/backend URL
- feature flags
- live/mock data source

### Auth

- Firebase project ID
- current UID
- role
- token expiry
- backend auth health

### API

- healthz/readyz
- latency
- recent error counts
- correlation ID search

### A2A

- Agent Registry
- AgentCard
- active tasks
- state
- sequence
- raw payload sanitized
- retry/cancel

### Agreement

- Agreement ID
- termsHash
- artifact relation
- duplicate detection

### Web3

- gateway health
- network
- mint allowlist
- operation
- receipt
- signature
- Explorer

### Firestore

- collection counts
- missing indexes
- migration version
- no arbitrary editor

---

## 4. Data Source Banner

```text
LIVE
DEMO
MOCK
```

Production에서 MOCK이면 critical warning.

---

## 5. Admin Actions

허용 가능한 제한적 action:
- retry safe operation
- cancel non-terminal Task
- reconcile receipt
- refresh health

금지:
- Agreement terms 직접 수정
- Escrow confirmed 강제 변경
- milestone 임의 release
- user role 임의 변경
- private key 표시

---

## 6. Audit

Admin action:
- actor
- target
- before/after
- reason
- correlation ID
- timestamp
