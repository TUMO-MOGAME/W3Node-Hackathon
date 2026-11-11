#!/usr/bin/env bash
# Show the deployed Heirloom program on devnet (run inside WSL).
set -uo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
solana program show b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY --url devnet
solana balance --url devnet
solana transaction-history b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY --url devnet --limit 3 2>/dev/null || true
command -v npx node || echo "no linux node/npx"
