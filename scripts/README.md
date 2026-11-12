# Heirloom scripts (devnet)

All wallets the scripts use are **Tether WDK** wallets (`@tetherto/wdk-wallet-solana`), and every transaction is
signed and sent by WDK. Seeds live in `scripts/.demo-wallets.json` and env lines in `scripts/.env.devnet`; both are
gitignored. **Devnet only: never put real funds in these wallets.**

The scripts resolve packages from `app/node_modules`, so always run them **from `app/`** with the scripts tsconfig:

```bash
cd app
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/devnet-setup.ts
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/seed-demo.ts
```

## 1. `devnet-setup.ts`
1. Creates WDK wallets for the personas: dad (owner), Lerato, Sipho, Naledi (children), Adv. Ndlovu, Ms. Pillay,
   Uncle Bongani (verifiers), Pieter and Ayesha (car buyers), the AI agent, and payees (UCT, a residence, a school).
2. Funds the dad with devnet SOL, then the dad funds everyone else with WDK native SOL transfers.
   **The devnet RPC faucet is closed** (`410 Gone`): the script prints the dad's address; fund it with ~2 SOL at
   <https://faucet.solana.com> (devnet) and re-run. Re-running is safe: it skips anything already done.
3. Creates a 6-decimal **test USD₮** mint and the car's **digital-title NFT** (decimals 0, supply 1, mint authority removed).
4. Mints test USD₮ to the dad and sends the buyers theirs with WDK `transfer` (SPL USD₮).
5. Writes `scripts/.env.devnet`. Copy its lines into `app/.env.local` (it contains `AGENT_SEED_PHRASE`, keep it private).

## 2. Deploy the program
Build and deploy `programs/heirloom` (inside WSL: `anchor build && anchor deploy --provider.cluster devnet`), then set
`NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID` in `app/.env.local` and copy `target/idl/heirloom.json` over
`app/src/lib/chain/idl/heirloom.json`. Run `npm test` in `app/`: `instructions.test.ts` fails loudly if the IDL's
account or arg names drift from the client.

## 3. `seed-demo.ts`
Creates the demo estate from the fixed WillDraft in `app/src/lib/agent/canned.ts` (`DEMO_WILL`) with the persona
wallets: estate (agent + 3 verifiers, thresholds 2/1/2, waiting period `NEXT_PUBLIC_DEMO_WAITING_SECS`, default 120 s),
will hash, 3 beneficiaries, 3 payees, 4 rules, a 20,000 USD₮ deposit and the car (floor 9,000, hardship floor 7,000,
asking 10,500; sale proceeds go back into the estate vault). With `SUPABASE_*` set it also stores display names.
Idempotent: existing accounts are skipped.

## 4. Use the personas in the app
Set `NEXT_PUBLIC_DATA_MODE=chain`, start the app, and import each persona's seed from `scripts/.demo-wallets.json`
(Wallet → Import). Each seed is encrypted on the device with a PIN; nothing is sent to the server.

## 4b. Laptop demo on devnet, history and rehearsal
- `demo-devnet.ps1`: starts the app in chain mode on devnet (loads `.env.local` + `scripts/.env.devnet` into the
  process; writes nothing). Full test path: [docs/devnet-test-guide.md](../docs/devnet-test-guide.md).
- `demo-history.ts [--dry]`: adds real history to the demo estate while the dad is alive (due scheduled payments, a
  reviewed and owner-approved school-fee claim, a vault top-up, pocket money to Lerato).
- `rehearse-devnet.ts`: the whole passing → unlock → claim → car-sale story on a THROWAWAY estate with tiny amounts,
  so the after-death flows are proven without touching the demo estate.

Run the .ts scripts from `app/` with the devnet env loaded (Git Bash):
`set -a; . ../scripts/.env.devnet; set +a; npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/demo-history.ts`

## 5. Voice agent
See [`elevenlabs-agent.md`](elevenlabs-agent.md) for the ElevenLabs dashboard configuration.

## Supabase
Apply `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`). It creates the metadata tables with RLS
on and no public policies, and the private `evidence` bucket.
