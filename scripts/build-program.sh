#!/usr/bin/env bash
# Build, test and (optionally) deploy the Heirloom Anchor program. Run inside WSL Ubuntu:
#
#   wsl -d Ubuntu -u tumo --cd ~ -- bash "/mnt/c/Users/tumom/Hackathons/W3Node Hacathon/scripts/build-program.sh" [test|deploy]
#
# Building on /mnt/c is slow, so the program sources are mirrored to ~/heirloom-build (Linux disk),
# built there, and the outputs (IDL, .so, program keypair) are copied back into the repo.
#   (no arg)  build + keys sync + copy IDL back + cargo test
#   test      same as no arg
#   deploy    the above, then `anchor deploy` to devnet (needs SOL on ~/.config/solana/id.json)
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
REPO="/mnt/c/Users/tumom/Hackathons/W3Node Hacathon"
WORK="$HOME/heirloom-build"
MODE="${1:-test}"

echo "== mirror sources to $WORK"
mkdir -p "$WORK/target/deploy"
rm -rf "$WORK/programs"
cp -r "$REPO/programs" "$WORK/programs"
cp "$REPO/Anchor.toml" "$REPO/Cargo.toml" "$WORK/"
[ -f "$REPO/Cargo.lock" ] && cp "$REPO/Cargo.lock" "$WORK/" || true
# Keep the program id stable: the repo's keypair (gitignored) is the source of truth.
if [ -f "$REPO/target/deploy/heirloom-keypair.json" ]; then
  cp "$REPO/target/deploy/heirloom-keypair.json" "$WORK/target/deploy/heirloom-keypair.json"
fi

cd "$WORK"
echo "== anchor keys sync (declare_id! + Anchor.toml = keypair pubkey)"
anchor keys sync
echo "== anchor build"
anchor build

echo "== copy outputs back to the repo"
mkdir -p "$REPO/target/deploy" "$REPO/target/idl" "$REPO/app/src/lib/chain/idl"
cp target/deploy/heirloom-keypair.json "$REPO/target/deploy/"
cp target/deploy/heirloom.so "$REPO/target/deploy/"
cp target/idl/heirloom.json "$REPO/target/idl/"
cp target/idl/heirloom.json "$REPO/app/src/lib/chain/idl/heirloom.json"
[ -f target/types/heirloom.ts ] && mkdir -p "$REPO/target/types" && cp target/types/heirloom.ts "$REPO/target/types/" || true
cp programs/heirloom/src/lib.rs "$REPO/programs/heirloom/src/lib.rs"   # declare_id! after keys sync
cp Anchor.toml "$REPO/Anchor.toml"
cp Cargo.lock "$REPO/Cargo.lock"

echo "== cargo test (LiteSVM)"
cargo test -p heirloom

if [ "$MODE" = "deploy" ]; then
  echo "== anchor deploy (devnet)"
  anchor deploy --provider.cluster devnet
fi

echo "== program id: $(solana-keygen pubkey target/deploy/heirloom-keypair.json)"
