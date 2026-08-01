#!/usr/bin/env bash
# KNOT — local settlement sandbox (per developer).
#
# Runs the on-chain milestone-settlement test against your OWN local
# solana-test-validator — no devnet, no airdrop limits, fast. This is the
# "each teammate tests locally" environment; the shared testnet deploy happens
# after merge via scripts/deploy_devnet.sh.
#
#   scripts/localnet_settlement.sh
#
# Prereqs: solana CLI, solana-test-validator, anchor on PATH (docs/HANDOFF.md);
# backend deps installed (pip install -e 'backend[dev]').
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"

RPC="http://127.0.0.1:8899"
SO="target/deploy/knot_escrow.so"
KP="target/deploy/knot_escrow-keypair.json"

PY="${PYTHON:-}"
if [[ -z "$PY" ]]; then
  for c in backend/.venv/bin/python .venv/bin/python python3 python; do
    command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
  done
fi

for bin in solana solana-test-validator anchor "$PY"; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "❌ '$bin' not found — see docs/HANDOFF.md (toolchain) and docs/SOLANA_ENVIRONMENTS.md"; exit 1; }
done

# `anchor keys sync` rewrites declare_id to match this machine's local program
# keypair; require those files clean so we can safely restore them on exit
# (keeps the committed devnet program id intact).
if ! git diff --quiet -- Anchor.toml programs/knot-escrow/src/lib.rs 2>/dev/null; then
  echo "❌ commit or stash your Anchor.toml / programs/knot-escrow/src/lib.rs changes first"; exit 1
fi
cleanup() {
  git checkout -- Anchor.toml programs/knot-escrow/src/lib.rs 2>/dev/null || true
  [[ -n "${VPID:-}" ]] && kill "$VPID" 2>/dev/null || true
}
trap cleanup EXIT

[[ -f "$HOME/.config/solana/id.json" ]] || \
  solana-keygen new --no-bip39-passphrase -s -o "$HOME/.config/solana/id.json" >/dev/null

echo "▸ building program (declare_id → local program keypair)"
[[ -f "$KP" ]] || anchor build >/dev/null
anchor keys sync >/dev/null
anchor build >/dev/null
PROG_ID="$(solana address -k "$KP")"
echo "  program id: $PROG_ID"

health() { curl -s -m 2 "$RPC" -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null | grep -q '"result":"ok"'; }
# Always run against a FRESH validator so the singleton escrow config is clean
# and the test is deterministic (stops any test-validator left from a prior run).
echo "▸ starting a fresh solana-test-validator"
pkill -f 'solana-test-validator' 2>/dev/null || true
sleep 1
rm -rf /tmp/knot-test-ledger
solana-test-validator --reset --quiet --ledger /tmp/knot-test-ledger >/tmp/knot-validator.log 2>&1 &
VPID=$!
for _ in $(seq 1 40); do health && break; sleep 1; done
health || { echo "❌ validator did not become ready (see /tmp/knot-validator.log)"; exit 1; }

echo "▸ funding + deploying to the local validator"
solana airdrop 100 --url "$RPC" >/dev/null 2>&1 || true
solana program deploy "$SO" --program-id "$KP" --url "$RPC" >/dev/null

echo "▸ running settlement test on localnet"
KNOT_RUN_LOCALNET=1 KNOT_ESCROW_PROGRAM_ID="$PROG_ID" SOLANA_RPC_URL="$RPC" \
  "$PY" -m pytest backend/tests/test_escrow_devnet.py -q
