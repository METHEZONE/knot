#!/usr/bin/env bash
# knot — Auth 에뮬레이터에 "데모 계정과 같은 uid" 로 로그인 계정을 만든다.
#
#   scripts/local/demo_login.sh [user-brand-1|user-brand-2|user-creator-1|user-creator-2]
#
# 왜: 배포 Firestore 의 데모 데이터(글로우 립밤 프로모션 등)는 ownerUid=user-brand-1 소유다.
# 내 구글 계정으로 로그인하면 대시보드가 소유권 필터에 걸려 빈다. 데모 계정 비밀번호는
# 시드 실행 시 --auth-password 로 정해진 값이라 모른다.
# → 에뮬레이터 admin API 는 localId(uid)를 지정해 계정을 만들 수 있고, 백엔드는 emulator 모드에서
#   토큰 payload 의 uid 를 그대로 신뢰하므로 그 데모 계정으로 로그인한 것과 동일해진다.
#   공유 Firebase 프로젝트의 계정·비밀번호는 건드리지 않는다.
#
# 전제: KNOT_ENV_FILE=.env.demo.local scripts/local/dev_stack.sh (Firestore + Auth 에뮬레이터)
set -euo pipefail
UID_TARGET="${1:-user-brand-1}"
PROJECT="${DEMO_EMULATOR_PROJECT:-demo-knot}"
EMU="${FIREBASE_AUTH_EMULATOR:-127.0.0.1:9099}"
PASSWORD="${DEMO_PASSWORD:-000000}"

case "$UID_TARGET" in
  user-brand-1)   EMAIL="t1@knot.com"; NAME="루미에르 뷰티 담당자" ;;
  user-brand-2)   EMAIL="test2@knot.demo"; NAME="바삭데이 담당자" ;;
  user-creator-1) EMAIL="c1@knot.com"; NAME="민지의 뷰티룸" ;;
  user-creator-2) EMAIL="test4@knot.demo"; NAME="하루한입" ;;
  *) EMAIL="$UID_TARGET@knot.demo"; NAME="$UID_TARGET" ;;
esac

curl -fsS -m 5 "http://$EMU" >/dev/null || { echo "❌ Auth 에뮬레이터($EMU)가 안 떠 있다 → dev_stack.sh 먼저"; exit 1; }

# 에뮬레이터 admin API 는 Bearer owner 를 받는다. 이미 있으면 지우고 다시 만든다(멱등).
ADMIN="http://$EMU/identitytoolkit.googleapis.com/v1/projects/$PROJECT/accounts"
curl -fsS -X POST "$ADMIN:delete" -H "Authorization: Bearer owner" -H "Content-Type: application/json" \
  -d "{\"localId\":\"$UID_TARGET\"}" >/dev/null 2>&1 || true
curl -fsS -X POST "$ADMIN" -H "Authorization: Bearer owner" -H "Content-Type: application/json" \
  -d "{\"localId\":\"$UID_TARGET\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"$NAME\",\"emailVerified\":true}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('   생성 uid:', d.get('localId'), '| email:', d.get('email'))"

cat <<INFO

✅ 브라우저에서 이 계정으로 로그인하면 배포본과 같은 화면이 보인다:

   http://127.0.0.1:3000/login
   이메일   $EMAIL
   비밀번호 $PASSWORD

(비밀번호는 로컬 에뮬레이터 전용 — 공유 Firebase 프로젝트와 무관하다)
INFO
