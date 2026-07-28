#!/usr/bin/env bash
# knot — "Agent에게 위임"(매칭 → A2A 협상 → 합의)만 실행한다. 정산은 브라우저에서 직접 누르도록 남긴다.
#
#   scripts/local/agent_run.sh --new                 # 매칭되는 프로모션을 새로 만들고 협상까지
#   scripts/local/agent_run.sh <promotionId>         # 기존 프로모션으로 협상까지
#
# 왜 필요한가: 현재 UI 에는 매칭·협상 시작 버튼이 없다(legacy 라우트가 리다이렉트로 바뀌며 사라졌다).
# 정산 실행 화면은 복구했으므로, 이 스크립트로 합의까지 만들어두고 정산은 화면에서 클릭해 검증한다.
#
# 전제: dev_stack.sh 기동 + localnet_bootstrap.py(게이트웨이 실서명) 완료.
#       KNOT_AUTH_MODE=emulator 이므로 토큰을 직접 만들어 쓴다(로컬 전용).
set -euo pipefail
API="${KNOT_API:-http://127.0.0.1:18080}"
WEB="${KNOT_WEB:-http://127.0.0.1:3000}"
DEMO_UID="${DEMO_UID:-user-brand-1}"
CATEGORY="${CATEGORY:-beauty}"

b64url() { python3 -c 'import base64,sys;print(base64.urlsafe_b64encode(sys.stdin.buffer.read()).decode().rstrip("="))'; }
TOKEN="$(printf '%s' '{"alg":"none","typ":"JWT"}' | b64url).$(printf '%s' \
  "{\"user_id\":\"$DEMO_UID\",\"email\":\"$DEMO_UID@knot.demo\"}" | b64url)."
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
pick() { python3 -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
step() { printf '\n▸ %s\n' "$1"; }

if [[ "${1:-}" == "--new" ]]; then
  step "프로모션 생성 (categories=[$CATEGORY] — 크리에이터 카테고리와 겹쳐야 매칭이 성립한다)"
  PROMOTION=$(curl -fsS "${AUTH[@]}" -H "Idempotency-Key: agentrun-$(date +%s)" -d "{
    \"productName\":\"로컬 검증 제품\",\"title\":\"[local] 정산 검증용 프로모션\",
    \"objective\":\"제품 인지도 및 콘텐츠 확보\",\"categories\":[\"$CATEGORY\"],
    \"targetAudience\":\"20-30대 관심 고객\",\"totalBudget\":1000,\"initialOffer\":300,
    \"maximumPerCreator\":500,\"autoAcceptCeiling\":400,\"maximumRounds\":3,
    \"deliverables\":[{\"format\":\"reel\",\"count\":1}],\"usageRights\":\"organicOnly\",
    \"deadline\":\"2026-08-26\",\"prohibitedClaims\":[]}" \
    "$API/api/v1/brand/promotions" | pick "d['data']['promotion']['promotionId']")
  echo "   promotion=$PROMOTION"
else
  PROMOTION="${1:?promotionId 또는 --new 필요}"
fi

step "매칭 실행"
MATCH=$(curl -fsS -X POST "$API/api/v1/promotions/$PROMOTION/matches:run" | pick "d['data']['matchRun']['matchRunId']")
CANDIDATES=$(curl -fsS "$API/api/v1/match-runs/$MATCH/candidates" | pick "len(d['data']['candidates'])")
echo "   matchRun=$MATCH  후보 ${CANDIDATES}명"

step "A2A 협상 → 합의"
RESULT=$(curl -sS -X POST "$API/api/v1/match-runs/${MATCH}:start-negotiation")
if ! printf '%s' "$RESULT" | grep -q '"data"'; then
  echo "   ❌ 협상 실패:"
  printf '%s' "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['detail']; print('     ', d.get('code'), '-', d.get('detail'))"
  echo "     → 후보가 적격이 아니다. 프로모션 카테고리를 크리에이터 카테고리(beauty 등)와 맞춰야 한다."
  exit 1
fi
AGREEMENT=$(printf '%s' "$RESULT" | pick "d['data']['agreement']['agreementId']")
NEGOTIATION=$(printf '%s' "$RESULT" | pick "d['data']['negotiation']['negotiationId']")
AMOUNT=$(printf '%s' "$RESULT" | pick "d['data']['agreement']['terms']['compensation']['baseAmountUsdc']")
echo "   negotiation=$NEGOTIATION"
echo "   agreement=$AGREEMENT  합의금액 ${AMOUNT} USDC"

cat <<INFO

── 브라우저에서 확인할 것 ──────────────────────────────
협상 원문(A2A)   $WEB/brand/negotiations/$NEGOTIATION
합의 상세         $WEB/brand/agreements/$AGREEMENT
정산 실행         $WEB/brand/settlement?agreementId=$AGREEMENT
                 → "Fund + verify + release" 버튼을 누르면 lock → 증빙 → 검증 → release 가
                   실제 온체인 서명으로 실행된다. 끝나면 합의 상세의 Signature 필드를 확인.
INFO
