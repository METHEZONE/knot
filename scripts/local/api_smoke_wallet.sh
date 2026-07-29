#!/usr/bin/env bash
# knot — 지갑/알림 API 스모크 (Stage 3). 브라우저·Firebase 없이 Product API만 검증한다.
#
#   scripts/local/api_smoke_wallet.sh [CREATOR|BRAND] [지갑주소]
#
# 전제: scripts/local/dev_stack.sh 로 Product API(:18080)가 떠 있고 KNOT_AUTH_MODE=emulator.
# emulator 모드는 서명 검증 없이 JWT payload만 디코드하므로(libs/auth/firebase.py) 토큰을 직접 만들어 쓴다.
# ⚠️ 로컬 전용 — 배포 환경은 KNOT_AUTH_MODE=firebase 여야 한다.
set -euo pipefail
API="${KNOT_API:-http://127.0.0.1:18080}"
ROLE="${1:-CREATOR}"
WALLET="${2:-7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU}"
UID_LOCAL="${KNOT_TEST_UID:-local-$(whoami)}"

b64url() { python3 -c 'import base64,sys;print(base64.urlsafe_b64encode(sys.stdin.buffer.read()).decode().rstrip("="))'; }
TOKEN="$(printf '%s' '{"alg":"none","typ":"JWT"}' | b64url).$(printf '%s' \
  "{\"user_id\":\"$UID_LOCAL\",\"email\":\"$UID_LOCAL@local.test\",\"name\":\"local tester\"}" | b64url)."
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

pretty() { python3 -m json.tool 2>/dev/null || cat; }
step() { printf '\n▸ %s\n' "$1"; }

step "GET /healthz"
curl -fsS "$API/healthz" | pretty

step "GET /api/v1/me  (첫 호출이 users/$UID_LOCAL 생성)"
curl -fsS "${AUTH[@]}" "$API/api/v1/me" | pretty

step "POST /api/v1/me/role  role=$ROLE  (에이전트 생성 — KNOT_AGENT_WALLET_PROVISION=true면 여기서 SM 키까지)"
curl -fsS "${AUTH[@]}" -H "Idempotency-Key: role-$UID_LOCAL-1" \
  -d "{\"role\":\"$ROLE\"}" "$API/api/v1/me/role" | pretty

step "POST /api/v1/me/wallet  (Stage 3 — Phantom 주소 저장)"
curl -fsS "${AUTH[@]}" -d "{\"walletAddress\":\"$WALLET\"}" "$API/api/v1/me/wallet" | pretty

step "GET /api/v1/me/notifications  (Stage 3 — 알림 목록. 트리거 미연결이라 아직 빈 배열이 정상)"
curl -fsS "${AUTH[@]}" "$API/api/v1/me/notifications" | pretty

cat <<'NOTE'

참고: 현재 /api/v1/me 응답(account)에는 walletAddress 필드가 없다.
      저장은 되지만 되읽기 계약이 없어 새로고침 시 UI가 저장된 주소를 못 보여준다.
      → routes.py `_current_user_payload` 의 account dict에 walletAddress 추가가 남은 작업.
NOTE
