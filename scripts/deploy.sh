#!/bin/bash
set -e

echo "Building program..."
cd "$(dirname "$0")/.."
anchor build

echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "Generating IDL..."
cp target/idl/magic_pump.json packages/shared/src/idl/magic_pump.json

echo "Deploy complete!"
echo "Program ID: $(solana address -k target/deploy/magic_pump-keypair.json)"
