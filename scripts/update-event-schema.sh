#!/usr/bin/env bash
set -euo pipefail

# Helper to regenerate the shared event schema from current contracts.
# Usage: ./scripts/update-event-schema.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "→ Looking for contract packages..."

if [ -d "acbu-smart-contract" ]; then
  CONTRACT_DIR="acbu-smart-contract"
elif [ -d "contracts" ]; then
  CONTRACT_DIR="contracts"
else
  echo "No contract directory found (acbu-smart-contract or contracts)."
  exit 1
fi

echo "→ Building contracts in $CONTRACT_DIR"
cd "$CONTRACT_DIR"
stellar contract build

echo "→ Generating JSON bindings"
mkdir -p "$ROOT_DIR/shared"
stellar contract bindings json \
  --wasm target/wasm32v1-none/release/*.wasm \
  | jq -S . > "$ROOT_DIR/shared/events-schema.json"

echo "✅ Updated shared/events-schema.json"
echo "   Remember to commit the updated schema."
