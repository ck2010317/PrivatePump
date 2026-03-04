#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "Building IDL..."
anchor build
echo "Copying IDL to shared package..."
mkdir -p packages/shared/src/idl
cp target/idl/magic_pump.json packages/shared/src/idl/magic_pump.json
echo "IDL generated and copied to packages/shared/src/idl/"
