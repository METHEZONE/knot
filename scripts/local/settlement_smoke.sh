#!/usr/bin/env bash
# knot — 정산 전체 경로 스모크 (로컬넷 실서명). "정산이 되는가"를 판정한다.
#
#   scripts/local/settlement_smoke.sh                        # 시드 프로모션(promotion-001) 자동 전체
#   scripts/local/settlement_smoke.sh <promotionId>          # 브라우저에서 내가 만든 프로모션으로
#   scripts/local/settlement_smoke.sh --agreement <id>       # 이미 만들어진 합의만 정산
#
# 현재 UI에는 매칭/협상/정산 버튼이 없다(legacy 라우트가 리다이렉트로 바뀜) — 그 단계를 이 스크립트가 대신 쳐주고,
# 결과는 /brand/agreements/{agreementId} 화면에서 Escrow state·signature 로 확인하면 된다.
#
# 전제: scripts/local/localnet_bootstrap.py 실행 후 dev_stack.sh 로 스택 기동
#       (게이트웨이가 KNOT_WEB3_SIGNING_MODE=devnet/testnet/live + 로컬넷 RPC 여야 한다)
#
# 흐름: 매칭 → A2A 협상/합의 → 에스크로 락(온체인) → 증빙 제출/검증 → 마일스톤 릴리즈(온체인)
#       → 크리에이터 USDC 잔액이 실제로 늘었는지 온체인 확인
# 메모리 저장소는 기동 시 데모 시드(promotion-001)가 들어 있어 브랜드/크리에이터 계정 없이도 돈다.
set -euo pipefail
RUNTIME="${KNOT_LOG_DIR:-/tmp/knot-local}"
STAMP="$(date +%s)"
jqp() { python3 -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
step() { printf '\n▸ %s\n' "$1"; }
wait_http() { local url="$1" n="${2:-30}"; for _ in $(seq 1 "$n"); do curl -fsS -m 5 "$url" >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }

[[ -f "$RUNTIME/env.localnet" ]] || { echo "❌ 정산 배선 없음 → .venv/bin/python scripts/local/localnet_bootstrap.py 먼저"; exit 1; }
# shellcheck disable=SC1091
. "$RUNTIME/env.localnet"
API="${KNOT_API:-http://127.0.0.1:18080}"
RPC="${SOLANA_RPC_URL:-http://127.0.0.1:8899}"

wait_http "$API/healthz" 30 || { echo "❌ Product API 준비 안 됨: $API/healthz"; exit 1; }
wait_http "${WEB3_GATEWAY_BASE_URL:-http://127.0.0.1:8082}/healthz" 30 || {
  echo "❌ Web3 Gateway 준비 안 됨: ${WEB3_GATEWAY_BASE_URL:-http://127.0.0.1:8082}/healthz"
  exit 1
}

step "서명 모드 / 지갑 준비"
echo "   signingMode=${KNOT_WEB3_SIGNING_MODE:-?} (devnet/testnet/live 이어야 실서명. simulated 면 Product API가 정산 성공으로 안 받는다)"
# 게이트웨이가 에이전트/크리에이터 토큰계정을 비-멱등 createAccount 로 만들기 때문에(solana.ts:95,140)
# 같은 지갑으로 두 번째 락을 걸면 "Provided owner is not allowed" 로 실패한다.
# → 스모크는 매 실행마다 지갑을 새로 뽑는다. (게이트웨이는 키페어 파일을 요청마다 읽으므로 재시작 불필요)
solana-keygen new --no-bip39-passphrase -s -f -o "$KNOT_AGENT_KEYPAIR_PATH" >/dev/null
solana-keygen new --no-bip39-passphrase -s -f -o "$KNOT_CREATOR_KEYPAIR_PATH" >/dev/null
echo "   에이전트/크리에이터 지갑 새로 발급 (비-멱등 토큰계정 생성 회피)"

if [[ "${1:-}" == "--agreement" ]]; then
  AGREEMENT="${2:?--agreement <agreementId> 필요}"
  step "기존 합의 사용: $AGREEMENT"
  CREATOR_AGENT=$(curl -fsS "$API/api/v1/agreements/$AGREEMENT" | jqp "d['data']['agreement']['creatorAgentId']")
else
  PROMOTION="${1:-promotion-001}"
  step "매칭 실행 ($PROMOTION)"
  MATCH=$(curl -fsS -X POST "$API/api/v1/promotions/$PROMOTION/matches:run" | jqp "d['data']['matchRun']['matchRunId']")
  echo "   matchRun=$MATCH"

  step "A2A 협상 → 합의(Agreement) 생성"
  AGREEMENT_JSON=$(curl -fsS -X POST "$API/api/v1/match-runs/$MATCH:start-negotiation")
  AGREEMENT=$(printf '%s' "$AGREEMENT_JSON" | jqp "d['data']['agreement']['agreementId']")
  CREATOR_AGENT=$(printf '%s' "$AGREEMENT_JSON" | jqp "d['data']['agreement']['creatorAgentId']")
  NEGOTIATION=$(printf '%s' "$AGREEMENT_JSON" | jqp "d['data']['negotiation']['negotiationId']")
  ROUNDS=$(curl -fsS "$API/api/v1/negotiations/$NEGOTIATION/messages" | jqp "len(d['data']['messages'])")
  echo "   agreement=$AGREEMENT"
  echo "   negotiation=$NEGOTIATION  (A2A 메시지 ${ROUNDS}건 — 에이전트끼리 이미 주고받고 끝났다)"
  echo "   협상 화면(브랜드):     http://127.0.0.1:3000/brand/negotiations/$NEGOTIATION"
  echo "   협상 화면(크리에이터): http://127.0.0.1:3000/creator/offers/$NEGOTIATION"
fi
echo "   확인 URL: http://127.0.0.1:3000/brand/agreements/$AGREEMENT"

step "에스크로 락 — 온체인 (여기서 실제 서명이 나와야 한다)"
EXISTING_LOCK=$(curl -fsS "$API/api/v1/agreements/$AGREEMENT/escrow")
ESCROW=$(printf '%s' "$EXISTING_LOCK" | jqp "(d['data'].get('escrow') or {}).get('escrowId') or ''")
if [[ -n "$ESCROW" ]]; then
  LOCK="$EXISTING_LOCK"
  echo "   자동 Agent lock 사용"
else
  LOCK=$(curl -fsS -X POST -H "Idempotency-Key: lock-$STAMP" "$API/api/v1/agreements/$AGREEMENT/escrow:lock")
  ESCROW=$(printf '%s' "$LOCK" | jqp "d['data']['escrow']['escrowId']")
fi
SIG=$(printf '%s' "$LOCK" | jqp "(d['data'].get('escrow') or {}).get('lockSignature') or '(없음)'")
echo "   escrow=$ESCROW"
echo "   lock signature=$SIG"

step "증빙 제출 + 검증 (milestone=content)"
EVIDENCE=$(curl -fsS -X POST -H "Content-Type: application/json" \
  -d "{\"url\":\"https://social.example/post/with-brand-and-ad\",\"submittedByAgentId\":\"$CREATOR_AGENT\",\"milestoneId\":\"content\"}" \
  "$API/api/v1/agreements/$AGREEMENT/evidence" | jqp "d['data']['evidence']['evidenceId']")
VERIFY=$(curl -fsS -X POST "$API/api/v1/evidence/$EVIDENCE:verify")
printf '%s' "$VERIFY" | python3 -c "
import json,sys
e=json.load(sys.stdin)['data']['evidence']
print('   판정:', e.get('verificationResult') or e.get('status') or json.dumps(e)[:200])"

step "마일스톤 릴리즈 — 온체인 정산"
AUTO_RELEASED=$(printf '%s' "$VERIFY" | jqp "(d['data'].get('autoRelease') or {}).get('status') == 'RELEASED'")
if [[ "$AUTO_RELEASED" == "True" ]]; then
  REL="$VERIFY"
  echo "   자동 Agent release 사용"
else
  REL=$(curl -fsS -X POST -H "Idempotency-Key: rel-$STAMP" \
    "$API/api/v1/escrows/$ESCROW/milestones/content:release")
fi
printf '%s' "$REL" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
s=(d.get('autoRelease') or {}).get('settlement') or d.get('settlement') or {}
print('   settlement status:', s.get('status'))
print('   release signature:', s.get('signature') or (d.get('autoRelease') or {}).get('receipt',{}).get('gatewayReceipt',{}).get('signature') or d.get('receipt',{}).get('gatewayReceipt',{}).get('signature'))
print('   amount(baseUnits):', s.get('amountBaseUnits') or s.get('releasedAmountBaseUnits'))
"

step "온체인 확인 — 크리에이터 토큰 잔액"
CREATOR_PUB=$(solana address -k "$KNOT_CREATOR_KEYPAIR_PATH")
spl_out=$(solana --url "$RPC" balance "$CREATOR_PUB" 2>/dev/null || true)
echo "   creator wallet=$CREATOR_PUB  SOL=$spl_out"
python3 - <<PY
import json,subprocess,time
mint="$KNOT_USDC_MINT"; owner="$CREATOR_PUB"; rpc="$RPC"
# commitment=confirmed 필수: 기본값 finalized 는 로컬 밸리데이터에서 ~15초 뒤에나 보인다.
body={"jsonrpc":"2.0","id":1,"method":"getTokenAccountsByOwner",
      "params":[owner,{"mint":mint},{"encoding":"jsonParsed","commitment":"confirmed"}]}
for attempt in range(6):
    out=subprocess.run(["curl","-s",rpc,"-X","POST","-H","content-type: application/json",
                        "-d",json.dumps(body)],capture_output=True,text=True).stdout
    accs=json.loads(out).get("result",{}).get("value",[])
    if accs:
        for a in accs:
            amt=a["account"]["data"]["parsed"]["info"]["tokenAmount"]
            print(f"   ✅ 크리에이터 USDC 잔액 {amt['uiAmountString']} (raw {amt['amount']}) @ {a['pubkey']}")
        break
    time.sleep(2)
else:
    print("   ❌ 크리에이터 USDC 토큰계정이 없다 — 릴리즈가 온체인에 반영되지 않았다")
PY
