#!/usr/bin/env bash
# KNOT — deploy the escrow program to the SHARED devnet.
#
# Run after merge, by the holder of the program keypair
# (target/deploy/knot_escrow-keypair.json). This is the shared environment used
# for the demo; day-to-day testing happens on each developer's local validator
# (scripts/localnet_settlement.sh). See docs/SOLANA_ENVIRONMENTS.md.
#
#   scripts/deploy_devnet.sh
#
# The wallet (~/.config/solana/id.json) needs devnet SOL — deploy rent is
# ~2.03 SOL; top up at https://faucet.solana.com if low.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"

RPC="https://api.devnet.solana.com"
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
echo "▸ deploying $PROG_ID to devnet (wallet balance: ${BAL:-?} SOL)"
solana program deploy "$SO" --program-id "$KP" --url "$RPC"
echo "✓ deployed."
echo "  verify: solana program show $PROG_ID --url devnet"
echo "  test:   KNOT_RUN_DEVNET=1 pytest backend/tests/test_escrow_devnet.py -q"
