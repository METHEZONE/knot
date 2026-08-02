#!/usr/bin/env bash
# KNOT — deploy the escrow program to the shared Solana devnet cluster.
#
# Run after merge, by the holder of the program keypair
# (target/deploy/knot_escrow-keypair.json). This is the shared environment used
# for the demo; day-to-day testing happens on each developer's local validator.
#
#   SOLANA_CLUSTER=devnet SOLANA_RPC_URL=https://api.devnet.solana.com scripts/deploy_devnet.sh
#
# The wallet (~/.config/solana/id.json) needs cluster SOL — deploy rent is
# ~2.03 SOL; top up at https://faucet.solana.com if low.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
if [[ -d /opt/homebrew/opt/rustup/bin ]]; then
  export PATH="/opt/homebrew/opt/rustup/bin:${PATH}"
fi

CLUSTER="${SOLANA_CLUSTER:-devnet}"
RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
SO="target/deploy/knot_escrow.so"
KP="target/deploy/knot_escrow-keypair.json"

for bin in solana anchor; do
  command -v "$bin" >/dev/null 2>&1 || { echo "❌ '$bin' not on PATH — see docs/HANDOFF.md"; exit 1; }
done
[[ -f "$KP" ]] || {
  echo "❌ program keypair $KP not present."
  echo "   Only the keypair holder can deploy the canonical devnet program id."
  echo "   (target/ is gitignored; obtain the keypair out-of-band or accept a new id via 'anchor keys sync')."
  exit 1
}

anchor build >/dev/null
PROG_ID="$(solana address -k "$KP")"
BAL="$(solana balance --url "$RPC" 2>/dev/null | awk '{print $1}')"
if [[ -z "${BAL}" ]]; then
  echo "❌ could not read deploy wallet balance on ${CLUSTER}"; exit 1
fi
if ! awk -v bal="$BAL" 'BEGIN { exit !(bal >= 2.2) }'; then
  echo "❌ deploy wallet needs at least 2.2 SOL on ${CLUSTER}; current balance: ${BAL} SOL"
  echo "   fund it first, then rerun this script."
  exit 1
fi
echo "▸ deploying $PROG_ID to ${CLUSTER} (wallet balance: ${BAL:-?} SOL)"
solana program deploy "$SO" --program-id "$KP" --url "$RPC"
echo "✓ deployed."
echo "  verify: solana program show $PROG_ID --url $RPC"
echo "  test:   KNOT_RUN_TESTNET=1 SOLANA_RPC_URL=$RPC pytest backend/tests/test_escrow_devnet.py -q"
