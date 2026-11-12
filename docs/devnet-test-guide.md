# Testing every payment on Solana devnet

The public site (heirloom-one-iota.vercel.app) is the **demo mode**: payments there are simulated.
To see **real** transactions, run Heirloom on your laptop in **chain mode** on Solana **devnet**.
Devnet uses free test USD₮ and test SOL: nothing here costs real money, so the amounts don't matter.
Small amounts still keep the vault full for the next run.

Every step below ends with a **Receipt** or Explorer link (explorer.solana.com, `?cluster=devnet`).
Open it: "Success" / "Finalized" means the transaction really happened on-chain.

## 0. Before you start (5 minutes)

1. Free disk space: at least 3 GB (`Get-PSDrive C`).
2. Start the app on devnet (keep this window open):
   ```powershell
   cd "C:\Users\tumom\Hackathons\W3Node Hacathon"
   powershell -ExecutionPolicy Bypass -File scripts\demo-devnet.ps1
   ```
   Wait for `Ready`, then open **http://localhost:3000**. The first page takes about a minute to compile.
3. Check it is on devnet: http://localhost:3000/api/health should show `"mode":"chain"`, `"programDeployed":true`,
   `"sponsorAvailable":true`.
4. Bring in the demo wallets, **once per browser** (use Chrome or Edge, not a private window):
   open `scripts\.demo-wallets.json` in Notepad. For each person below, go to **http://localhost:3000/start?new=1**:
   - Name: as below. "I am": as below. Tick **I already have a recovery phrase** and paste that person's
     `seeds` value from the file (the 12/24 words). Tick the consent box, then **Continue**.
   - PIN: use the same 6-digit PIN for everyone (e.g. `246810`). Then **Bring in my wallet**.

   | Name | "I am" | Seed in the file |
   |---|---|---|
   | Thabo | Planning for my family | `dad` |
   | Lerato | A family member | `lerato` |
   | Adv. Ndlovu | A trusted person | `ndlovu` |
   | Ms. Pillay | A trusted person | `pillay` |
   | Pieter | Buying a car from an estate | `pieter` |

   Switch person at any time with the **person card at the bottom of the sidebar**.
   Never share or screen-record that file: the seeds are devnet-only, but keep the habit.
5. Sample documents to upload are in `docs\demo-documents\`: `death.pdf`, `fees.pdf` and `affidavit.pdf`.
   They are marked as DEMO documents, so the AI agent will say "needs a person" for the certificate and affidavit
   (an honest flag), but it never blocks them, and the trusted people decide.

## A. While Thabo is alive (can be repeated any time)

| # | Who | Where | Do | You should see |
|---|---|---|---|---|
| A1 | Thabo | **Estate** | Look at the vault, rules and the activity list | Vault about 20,000 USD₮; recent history: residence payments, Naledi's school fees paid, a 500 top-up, 50 sent to Lerato |
| A2 | Thabo | **Estate** → scheduled payment | **Pay now** on Lerato's residence payment when it says **Due now** | Payment sheet → Confirmed → Receipt. Residence +300 |
| A3 | Thabo | **Estate** → **Add or withdraw** → **Add to vault** | Add **5** USD₮ | Confirmed; vault +5 |
| A4 | Thabo | **Send to family** | Pick Lerato, amount **1**, **Review payment** → **Approve**, enter PIN | "Network fee … paid by Heirloom"; Confirmed; Receipt |
| A5 | Lerato | **Send to family** | **Someone else**, paste Sipho's address from the file (`addresses.sipho`), **1** → Review → Approve | Fee paid by Heirloom: Lerato's SOL does not change |
| A6 | Any | **Call Heirloom** | Ask "How much is in the vault?", "Who are my trusted people?" | Spoken answers with the real devnet numbers |

## B. The passing → unlock (one-way: do it once, ideally on camera)

After this, the estate stays unlocked. Section A's living-plan steps then stop and section C opens.

| # | Who | Where | Do | You should see |
|---|---|---|---|---|
| B1 | Lerato | **Timeline** → **Report a passing** | Upload `death.pdf`, submit | "Report received"; the agent's report (needs a person, demo document); Receipt |
| B2 | Adv. Ndlovu | **Inbox** | Read the report → **Confirm the passing** | "1 of 2 trusted people approved" |
| B3 | Ms. Pillay | **Inbox** | **Confirm the passing** | "The waiting period is running" (60 seconds on this demo) |
| B4 | Thabo (optional) | **Estate** | You'll see **I'm still here**. Don't press it unless you want to cancel the passing | |
| B5 | Anyone | **Estate** / **Timeline** | After 60 s: **Unlock the estate** | "The estate is unlocked"; Receipt |

## C. After unlock: claims and the car sale

| # | Who | Where | Do | You should see |
|---|---|---|---|---|
| C1 | Lerato | **Claims** | Tuition rule → payee University of Cape Town → amount **5** → upload `fees.pdf` → **Submit claim** | "Claim submitted"; agent's report "Looks genuine"; Receipt |
| C2 | Adv. Ndlovu | **Inbox** | **Approve and pay** | "Approved. The vault paid University of Cape Town directly"; Receipt; vault −5 |
| C3 | Lerato | **Claims** | Type **5,000** on the same rule (don't submit) | A warning: over the per-claim cap of 4,000. The contract would refuse it too |
| C4 | Adv. Ndlovu | **Car** | **Open the sale** | Car listed; "Offers in escrow" |
| C5 | Pieter | **Car** | **Make an offer** of **9,500** → **Put offer in escrow** | Offer in escrow; Receipt (test USD₮; the minimum is 9,000) |
| C6 | Pieter | **Car** | Type an offer of **8,000** (don't submit) | "Blocked: below the minimum". The contract never accepts a sale under the floor |
| C7 | Adv. Ndlovu | **Car** | **Ask the agent to settle** | The agent ranks the offers and accepts the best one; the car's title goes to Pieter and 9,500 to the vault; Receipt |
| C8 | Optional: Lerato | **Hardship** | Upload `affidavit.pdf` (must be done **before** C7) | Two trusted people approve, then offers from 7,000 are allowed |

## D. Check it really happened

- Each **Receipt** opens Solana Explorer: status **Success**, the program `b3PBVwkL…FY`, the token transfer amounts.
- The estate account: https://explorer.solana.com/address/JBdsDy67YBfpV8YAc2H1h7w95h8uJ2XUzTDh9vt34G9E?cluster=devnet
- The whole B + C story was rehearsed on 12 Nov 2026 on a throwaway estate (`scripts/rehearse-devnet.ts`,
  estate `9jn713f444XH5E9uywJ6oNJJDrWWDoEcho2gWUrPnE3d`): unlocked, claim paid, car sold, vault 20 → 26.

## If something goes wrong

| Problem | Fix |
|---|---|
| "Server responded with 429" in the dev overlay | The free devnet RPC is busy; the app retries by itself. Wait a few seconds |
| Sponsor unavailable / fee not paid by Heirloom | The fee wallet `261pQ…sjNg` is low on SOL. Top it up at https://faucet.solana.com |
| A step says "BadStatus" | That step belongs to another phase (e.g. a claim on an after-passing rule before unlock) |
| Want to record B and C again | The demo estate can't be "un-passed". Ask Claude to seed a fresh demo estate (a new dad wallet) |
| Voice call says it can't see the estate | Open the call from a page after the estate has loaded (the sidebar shows the person) |
