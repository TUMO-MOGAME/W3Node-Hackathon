# Heirloom: plan

> Working name: **Heirloom**. Rename it whenever you like.
> Owner: Tumo. Started 2026-11-11. Progress lives in [status.md](status.md); this file holds the design.

## 0. Hackathon facts (from the participant guide)
- Final submission on **BuilderBase by Fri 13 Nov 2026, 23:59 SAST**: project title, **public GitHub repo with README**, **demo video ≤ 3 min** (YouTube/Drive, "anyone with the link").
- Judging Sat 14 Nov at Park View Event Space, Woodstock: **5-minute pitch + 3-minute Q&A**, live demo from a laptop, video as backup. At most 2–3 slides with 4 bullets each.
- Rubric (90 points, 30 each): **Product** (UX, UI quality, usability, flows, accessibility, polish); **Technical** (code quality, architecture, functionality, **deployed on testnet/mainnet**, performance, reliability); **Business** (African problem, solution–market fit, target users, **validated users**, commercial viability, GTM, **local infrastructure integration**).
- Disclose any pre-existing code. Never commit keys or seed phrases.

## 1. The idea in one paragraph

A parent writes a will by chatting with an AI agent. The agent turns the wishes into strict rules
that the parent reviews and signs with their wallet. Money (USDT on Solana) and assets (for example
a car, held as an on-chain "digital title") are locked in a vault that a Solana program controls.
Nothing moves while the parent is alive. After death is proven, the vault unlocks, and from then on
**money moves only when a rule allows it**: school fees are paid straight to the university, not to
the child; the car is sold only at or above the parent's minimum price, unless a family member proves
real hardship. The AI agent does the reading and recommending, but **the smart contract enforces the
limits** and **people the parent trusts** must approve anything unusual.

## 2. Use cases we must support

| # | Case | Rule enforced on-chain | Who has to agree |
|---|---|---|---|
| U1 | Write the will | Rules are hashed and signed by the owner; they can't change after death | Owner |
| U2 | Fund the vault | Only the owner can deposit or withdraw while the estate is "Active" | Owner |
| U3 | Prove death | 2 of 3 verifiers confirm, then a waiting period passes; the owner can veto ("I'm alive") at any time | Agent check + 2-of-3 verifiers |
| U4 | Pay school fees | Payee must be an approved institution; per-claim, per-year and lifetime caps; the rule ends at a set date | Agent review + 1 verifier |
| U5 | Pay accommodation | Same as U4, payee must be an approved landlord or residence | Agent review + 1 verifier |
| U6 | Sell the car at the best price | Sale price must be ≥ the owner's **floor price**; USDT and the title swap in one transaction | Agent picks the best offer |
| U7 | Sell the car below the floor (hardship) | Allowed only with an approved hardship request, and never below a **hardship floor** | Agent review + 2-of-3 verifiers |
| U8 | Dead man's switch (P1) | No owner check-in for N months starts the U3 death process | Same as U3 |
| U9 | Dispute (P1) | Any beneficiary or verifier can freeze a pending action during its waiting period | Resolved by 2-of-3 verifiers |

**Verifiers** are 3 people the owner names when writing the will, for example the executor named in
the legal will, a lawyer and a trusted family member. Making the executor verifier #1 ties the app to
the legal estate process (see section 6).

## 3. Research findings (2026-11-11)

### 3.1 The hackathon
- **W3Node Nov 2026**: Cape Town, Parkview Event Space, **12–14 November 2026**. A 2-day conference plus a 3-day
  hackathon with 6 tracks and prizes. Free "Apply to hack" pass on the Node Engine page.
  **Track list and judging criteria were not published online. Get them at check-in.**
  Sources: [Eventbrite](https://www.eventbrite.com/e/w3node-nov-2026-tickets-1996784195280),
  [w3node.io](https://w3node.io/#nodeengine), [Exporb](https://exporb.com/events/w3node-conference-and-hackathon).
- An earlier edition ran 22–24 Jan 2026. Its stated focus areas: payments, AI, gaming, identity
  ([Coinpedia](https://events.coinpedia.org/w3node-conference-and-hackathon-7719/)). Heirloom fits payments + AI.

### 3.2 Tether on Solana
- USDT is issued **natively** on Solana as an SPL token. Official mint (check it again before mainnet):
  `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`, 6 decimals.
  Sources: [Eco](https://eco.com/support/en/articles/14998910-usdt-on-solana-network-mint-address-fees-and-wallets-2026), [Solana Compass](https://solanacompass.com/projects/Tether).
- Fake "USDT" tokens with other mint addresses exist. **The program must store the accepted mint and reject any other.**
- USDT0 (bridged via LayerZero) is a different token ([The Block](https://www.theblock.co/post/374786/tether-linked-usdt0-and-xaut0-launch-on-solana-via-layerzero-tech)). We don't need it.
- On devnet there is no official USDT, so we **create our own 6-decimal test mint** and the program is
  configured with whichever mint the cluster uses.

### 3.2a Tether WDK (required for the Tether track)
- Tether's **Wallet Development Kit (WDK)** is open source and supports Solana through **`@tetherto/wdk-wallet-solana`**
  (BIP-39 seed, path m/44'/501', classes `WalletManagerSolana` / `WalletAccountSolana`). There is also a
  **gasless Solana module**, so family members don't need SOL for fees. Since Aug 2026 (v1.0.0-beta.14) it can
  **sign and send base64 serialised transactions**, which is how we sign our program's instructions.
  Sources: [WDK changelog](https://docs.wdk.tether.io/overview/changelog/), [wallet-solana](https://awesome.ecosyste.ms/projects/github.com%2Ftetherto%2Fwdk-wallet-solana),
  [Build with AI](https://docs.wdk.tether.io/start-building/build-with-ai) (includes a docs MCP server for agents).
- Previous Tether hackathons' **technical must-haves** were: WDK for wallet operations, an AI agent, Tether tokens (USD₮),
  and a clear README ([Galactica WDK Edition](https://dorahacks.io/hackathon/hackathon-galactica-wdk-2026-01/builder-hub),
  [Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup/tracks)). **Read W3Node's own Tether track rules** and tick them off in §3.2b.

### 3.2b How Tether is visibly used (the judging checklist)
| Requirement | Where Heirloom shows it |
|---|---|
| USD₮ is the money | Vault, tuition payouts, car offers and sale proceeds are all USD₮ (SPL); the program rejects any other mint |
| WDK wallet operations | Every in-app wallet (owner, children, verifiers, buyers, **the agent's own wallet**) is created and signed with `@tetherto/wdk-wallet-solana` |
| Self-custodial | Seed phrases are generated and kept on the user's device by WDK; Heirloom's servers never hold user keys |
| AI agent with a wallet | The agent's WDK wallet signs `review_*` / `accept_offer` and shows its USD₮ activity |
| Proof on chain | Dashboard links every USD₮ transfer to Solana Explorer; README has a "Where Tether is used" section with file links |
| Real USD₮ (optional) | One small real USD₮ transfer on mainnet with a WDK wallet, shown in the video; the program itself stays on devnet |

### 3.3 Solana tooling in 2026
- **Anchor 1.0** has been stable since April 2026. OtterSec now looks after it ([otter-sec/anchor](https://github.com/otter-sec/anchor)).
  Changes that matter to us ([release notes](https://www.anchor-lang.com/docs/updates/release-notes/1-0-0)):
  the TypeScript client moved from `@coral-xyz/anchor` to **`@anchor-lang/core`**; `anchor init` now creates
  **LiteSVM** Rust tests by default; and **Surfpool** is the local validator. Anchor v2 is still alpha/RC, so we don't use it.
- **`@solana/kit`** is the current JS client and `@solana/web3.js` v1 is in maintenance mode
  ([Solana docs](https://solana.com/docs/frontend/web3-compat)). Whether Anchor 1.0's TS client runs on Kit was
  **not confirmed**. Check this on day 0 (see section 7, risk R6).
- **Metaplex Core** is the current NFT standard: one account per asset, with plugins
  ([docs](https://www.metaplex.com/docs/smart-contracts/core)). We use it for the car's "digital title".
  MPL-3643 (permissioned RWA tokens, announced Sept 2026) has no availability date yet, so we skip it.
- Escrow and auction patterns to borrow from: the Anchor escrow example and
  [solana-developers/program-examples](https://docs.chainstack.com/docs/solana-escrow-pattern), plus
  NFT-for-token auction escrows such as [auction-doge-rust](https://awesome.ecosyste.ms/projects/github.com%2F0xapp123%2Fauction-doge-rust).

### 3.4 Similar projects, and how we differ
Existing Solana inheritance projects are mostly **dead man's switches**: when the owner stops checking in,
named wallets get everything. Examples: [SolWill](https://solwill.pages.dev/),
[LifeProof](https://life-proof-mocha.vercel.app/), [Cyber-Vault](https://github.gg22.workers.dev/ozoneRatchapon/cypher-vault),
[Last Safe](https://devpost.com/software/last-safe), [Heres Protocol](https://chain.link/hack-26/projects/heres-protocol).
**What makes Heirloom different:**
1. Money is released **per purpose and paid to the institution**, not handed to heirs in one lump.
2. An **AI agent writes the rules and reviews evidence**, but cannot go past limits the contract enforces.
3. **Assets are sold by the estate** with a floor price, plus a strict hardship exception.
4. **A human quorum** (including the executor) is required for death and for exceptions.

### 3.5 South African legal and real-world facts
- **Wills:** the Wills Act 7 of 1953 still requires a signed, witnessed will. ECTA excludes wills from electronic
  signatures, and purely electronic wills are not yet valid; courts are hearing test cases
  ([Cliffe Dekker Hofmeyr](https://www.cliffedekkerhofmeyr.com/en/news/publications/2025/Practice/Trusts-Estates-Law/trusts-and-estates-law-alert-20-March-valid-or-not-valid-unsigned-electronic-wills-in-south-africa),
  [legalwills.co.za](https://www.legalwills.co.za/blog/2026/01/08/modern-wills/)).
  **So Heirloom does not replace a will.** Pitch it as a programmable trust or estate-instruction layer
  that the legal will points to.
- **Executors:** the Master of the High Court appoints the executor named in the will
  ([DOJ](https://justice.gov.za/master/deceased-how.html)).
- **Cars:** a car has no "title deed" in SA. Ownership is the **eNaTIS registration**. When a car is in a deceased
  estate, the **executor must keep it registered**, and the transfer needs the **letter of executorship**
  ([gov.za](https://www.gov.za/services/services-residents/driving/register-motor-vehicle/register-vehicle-deceased-person-or),
  [regulation 53](https://www.acts.co.za/national-road/r225_53__duty_of_title_holder_)). Change of ownership is
  notified on the NCO form within 21 days ([gov.za](https://www.gov.za/services/services-residents/driving/register-motor-vehicle/change-owner-or-titleholder-particulars-for-vehicle)).
  **So the on-chain NFT is a "digital title" that gates the handover, not the legal title.** When the sale settles,
  the app produces a handover pack (buyer details, NCO data, the executor's tasks).
- **Death checks:** there is no public Home Affairs API. Paid ID-verification services report deceased status,
  but Home Affairs updates its records **3–5 weeks after** the certificate is issued
  ([WinDeed](https://www.windeed.co.za/?p=5015), [PB Verify](https://pbverify.freshdesk.com/support/solutions/articles/17000007326-realtime-profile-id-marital-status-home-affairs-verifcation)).
  That is why we rely on verifier attestation plus a waiting period, and treat an ID check as a later add-on.
- **Affidavits:** sworn before a Commissioner of Oaths under Act 16 of 1963. SAPS stations commission them
  **free of charge**, and in-person commissioning is still the standard
  ([CMS](https://cms.law/en/srb/publication/cms-international-disputes-digest-2024-winter-edition/law-and-technology-the-future-of-commissioning-in-south-africa)).
  The agent checks that an affidavit has the jurat, the commissioner's details, a stamp and a date. **A person still
  approves hardship.**
- **Car prices:** TransUnion's Auto Dealers' Guide is the industry reference, but has **no self-serve API** (access is
  commercial). Consumer reports cost about R19 ([BusinessTech](https://businesstech.co.za/news/motoring/196690/the-book-that-dealers-use-to-value-your-car-is-going-digital-in-sa/)).
  For the hackathon the agent uses web search on public listings to suggest an asking price. The owner's floor is what binds.
- **USDT → rand:** universities and landlords want ZAR. Options: Luno Settlements (API, ZAR payouts to third parties),
  Stables (USDT→ZAR API with PayShap/EFT), VALR, Yellow Card, Kotani Pay
  ([Stablecoin Insider](https://stablecoininsider.org/best-stablecoin-ramps-africa/), [Stables](https://stables.money/transfers/south-africa),
  [Luno](https://www.luno.com.ng/settlements)). Providers must be FSCA-licensed, and exchanges report to SARS under
  CARF from March 2026 ([TransFi](https://www.transfi.com/blog/how-to-convert-usdt-to-zar-in-south-africa-bank-transfers-wallets-and-compliance-explained)).
  **For the hackathon** we pay "verified institution wallets" and show the off-ramp as the next step.

## 4. Stack

| Layer | Choice | Why |
|---|---|---|
| Smart contract | **Rust + Anchor 1.0** (stable), one program `heirloom` | Standard for Solana, with good escrow and PDA examples |
| Contract tests | **LiteSVM** (Anchor 1.0 default); **Surfpool** for localnet | Fast, and the current default |
| Token | USDT SPL (mainnet mint above); **our own 6-decimal mint on devnet** | Mint stored per estate, other mints rejected |
| Car digital title | **SPL NFT** (0 decimals, supply 1, metadata JSON with the registration doc hash), held by the estate PDA | Same token code path as USD₮, so it's safe to build in 2 days. Metaplex Core is the post-hackathon upgrade |
| Frontend | **Next.js (App Router) + TypeScript**, Tailwind with design tokens | Fast to build; deploys to Vercel |
| Wallet | **Tether WDK** (`@tetherto/wdk-wallet-solana`, plus the gasless module if setup is quick) for every role | Tether track requirement; no Phantom install needed for judges |
| Program client | `@anchor-lang/core` builds instructions → serialise → **WDK signs and sends** | Verify on day 0 (R6) |
| AI agent | **Google Gemini** (`@google/genai`), model from `GEMINI_MODEL`; structured output, PDF/image input, Google Search grounding, function calling | Tumo's choice (2026-11-11). Turns a will into rules, checks documents, ranks offers, values the car |
| Agent architecture | **Orchestrator + specialists**: WillWriter, DocumentReviewer, ClaimsGuide, CarBroker, EstateGuide, Compliance. `POST /api/agent/orchestrate` returns `{specialist, reply, actions[]}` | One brain for text chat and voice; specialists keep prompts focused |
| Voice | **ElevenLabs Agents** (`@elevenlabs/react`): "Talk to Heirloom" call; signed URL from `/api/voice/session`; ElevenLabs calls the orchestrator via a webhook tool | Wow factor plus accessibility for people who prefer speaking to typing |
| App form | **PWA**: one Next.js codebase, installable on Android/iPhone home screens; offline shell | "A website and an app" in 2 days, no app store |
| Agent signing | The agent has its **own WDK wallet** (server side) and may only call `review_*` / `accept_offer` | The contract limits what the agent can do |
| Off-chain data | **Supabase** (Postgres + Storage) for uploaded documents; only SHA-256 hashes on-chain. Encryption before upload is P2 | Quick to set up; keeps personal data off-chain (POPIA) |
| Hosting | Vercel (app) + Solana devnet (program) | Free tier, live demo URL |

### Why not other options
- **Ethereum/L2s:** you asked for Solana and Tether, and Solana fees are low enough for per-claim payouts.
- **On-chain document storage:** death certificates and IDs are personal information under POPIA. Never put them on a public chain.
- **Fully autonomous AI payouts:** uploaded documents can carry instructions aimed at the agent (prompt injection), and the
  model can be wrong. The contract caps and human quorum are the real safety net; the agent only speeds things up.

## 5. Design

### 5.1 On-chain accounts (PDAs)
```
Estate      seeds ["estate", owner]
  owner, usdt_mint, status {Active | DeathPending | Unlocked | Frozen},
  verifiers[3], death_threshold (2), claim_threshold (1), hardship_threshold (2),
  waiting_period_secs, death_pending_since, last_heartbeat, heartbeat_interval_secs,
  will_hash [32], will_uri, agent (pubkey), bump
Vault       ATA of usdt_mint owned by Estate PDA
Beneficiary seeds ["beneficiary", estate, wallet]   name_hash, active
Payee       seeds ["payee", estate, wallet]         kind {University | School | Landlord | Other}, approved
Rule        seeds ["rule", estate, id]
  beneficiary, category {Tuition | Accommodation | Books | Medical | General},
  max_per_claim, max_per_period, period_secs, period_start, spent_in_period,
  lifetime_cap, spent_total, valid_until, payee_kinds_allowed
Claim       seeds ["claim", rule, n]
  amount, payee, evidence_hash, agent_verdict {Pending|Ok|Reject}, agent_report_hash,
  approvals bitmap, status {Open | Approved | Paid | Rejected | Disputed}, created_at
DeathClaim  seeds ["death", estate]   cert_hash, submitted_by, agent_verdict, attestations bitmap
Asset       seeds ["asset", estate, core_asset]
  core_asset, kind {Vehicle | Other}, floor_price, hardship_floor, proceeds_to,
  status {Held | Listed | Sold}, listing_ends, doc_hash (registration papers)
  (P0: core_asset = an SPL NFT mint held in the estate PDA's token account)
Offer       seeds ["offer", asset, buyer]   amount (escrowed USDT in offer vault ATA), created_at
Hardship    seeds ["hardship", asset, beneficiary]
  evidence_hash, agent_verdict, approvals bitmap, status, payout_to
```

### 5.2 Instructions
| Phase | Instruction | Signer | Key checks |
|---|---|---|---|
| Setup | `create_estate` | owner | verifiers distinct; thresholds ≤ 3; mint fixed |
| | `add_beneficiary`, `add_payee`, `add_rule`, `set_will_hash` | owner | estate Active |
| | `register_asset` (moves the car NFT into the estate PDA) | owner | floor ≥ hardship_floor |
| | `deposit` / `withdraw` | owner | Active only |
| | `heartbeat` | owner | updates last_heartbeat |
| Death | `submit_death_claim(cert_hash)` | any beneficiary | Active |
| | `review_death(verdict, report_hash)` | agent | — |
| | `attest_death` | verifier | sets bit; at threshold → DeathPending, starts timer |
| | `veto_death` | owner | any time before Unlocked → back to Active |
| | `finalize_unlock` | anyone | DeathPending and timer passed → Unlocked |
| Claims | `submit_claim(rule, amount, payee, evidence_hash)` | beneficiary | Unlocked; payee approved and of an allowed kind; caps |
| | `review_claim(verdict, report_hash)` | agent | — |
| | `approve_claim` | verifier | — |
| | `execute_claim` | anyone | agent Ok + approvals ≥ claim_threshold; re-check caps; vault → payee ATA |
| Car sale | `list_asset(duration)` | agent or verifier | Unlocked |
| | `place_offer(amount)` / `withdraw_offer` | buyer | USDT into the offer escrow |
| | `submit_hardship(evidence_hash, payout_to)` | beneficiary | — |
| | `review_hardship` (agent), `approve_hardship` (verifier) | | — |
| | `accept_offer(offer)` | agent | amount ≥ floor, **or** hardship approved and amount ≥ hardship_floor; **one atomic transaction**: USDT → proceeds_to (or the hardship payout), car NFT → buyer |
| | `refund_offer` | anyone | after the sale or the listing ends |

### 5.3 The AI agent (server side, Claude)
1. **Will writer:** a chat UI. Output is **structured JSON** (beneficiaries, rules, assets, floors, verifiers)
   validated with a schema, then shown to the owner in plain language. The owner signs; we hash the JSON (SHA-256)
   and store the hash on-chain.
2. **Document reviewer:** reads PDFs/photos (death certificate, enrolment letter, fee statement, lease, affidavit,
   bank statements). Returns `{verdict, extracted_fields, red_flags, confidence}`. The system prompt treats document
   text as data, never as instructions. The report is hashed on-chain.
3. **Car valuer and broker:** uses web search on public SA listings for the same make, model, year and mileage to
   suggest an asking price, then ranks offers (price, buyer verified, time) and calls `accept_offer` with the best
   offer that passes on-chain checks.
4. The agent keypair can **only** call `review_*`, `list_asset` and `accept_offer`. It can never move funds outside the rules.

### 5.4 Screens
1. Landing page and wallet connect
2. **Owner:** will-writer chat → review rules → sign; fund vault; register car; heartbeat button; estate dashboard
3. **Family:** upload death certificate; claims (upload evidence → status timeline); hardship request
4. **Verifier:** inbox of items to attest or approve, each with the agent's report
5. **Buyer:** car listing page with the asking price, place a USDT offer, receive the title NFT and handover pack
6. **Public audit view:** estate timeline from on-chain events (no personal data)

## 6. Positioning (for the pitch)
"Heirloom is a programmable estate trust. Your legal will names your executor and points to your Heirloom estate.
Heirloom makes sure that what you wanted actually happens: tuition is paid to the university, the car isn't
dumped below its value, and nobody can drain the vault with a fake certificate." Mention POPIA (no personal data
on-chain), FSCA-licensed off-ramps as the next step, and the executor in the verifier quorum.

## 7. Risks and mitigations
| # | Risk | Mitigation |
|---|---|---|
| R1 | Fake death certificate | 2-of-3 verifiers + waiting period + owner veto + agent red flags |
| R2 | Prompt injection in uploaded docs | Agent can't move money beyond caps; human approval needed; structured output only |
| R3 | Agent key stolen | Key limited to review/listing roles; verifiers can freeze; rotate via verifier quorum (P1) |
| R4 | NFT is not legal ownership of the car | Say so plainly; handover pack + executor step; future eNaTIS integration |
| R5 | Institutions don't take USDT | Verified payee wallets now; ZAR off-ramp later |
| R6 | Anchor 1.0 TS client / Kit / WDK signing compatibility | Spike 2 today; fallback: build the tx with Kit (Codama client) and hand WDK the base64 tx |
| R10 | WDK Solana module is beta (v1.0.0-beta.x) | Pin the exact version; keep a fallback that signs with a local keypair, used only if WDK breaks, and disclose it |
| R11 | Track rules unknown | Read W3Node's Tether track rules first; the checklist in §3.2b is built from Tether's previous hackathons |
| R7 | Windows toolchain | Use **WSL2 Ubuntu** for Rust/Solana/Anchor; the Next.js app can run on Windows |
| R8 | Only 3 days | Strict P0 scope below; P1/P2 only if time allows |
| R9 | Unaudited contract | Devnet only; say "not audited" on the demo |

## 8. Scope (deadline: **13 Nov 2026**)

**P0 (must have for the demo):** U1, U2, U3 (with a 2-minute demo waiting period), U4, U6, U7, the verifier inbox,
WDK wallets for every role, a devnet deploy, a live URL, and a README with "Where Tether is used".
Contract simplifications for P0: per-claim cap + lifetime cap + `valid_until` (no per-year period yet); payees approved
by the owner at setup; one asset per estate.
**P1:** U5, U8 heartbeat, U9 disputes, public audit view, per-year caps, agent key rotation, gasless WDK.
**P2 (after the hackathon):** ZAR off-ramp, ID/deceased check via a verification provider, TransUnion valuations,
encrypted document sharing with Lit or similar, audit, mainnet, plus the full Tumoolo launch standard
(POPIA policy, consent boxes, Lighthouse ≥ 90, axe, CSP, etc.).

## 9. Repo layout
```
/programs/heirloom       Anchor program (Rust)
/programs/heirloom/tests LiteSVM tests
/app                     Next.js app (UI + API routes + agent)
/app/src/content         All copy (house style: copy in content files)
/app/src/lib/agent       Claude prompts, schemas, tools
/app/src/lib/chain       Program client, PDAs, tx builders
/scripts                 devnet setup: test USDT mint, airdrop, demo estate seeding
plan.md  status.md  CLAUDE.md
```

## 10. Build schedule (submit by end of **Fri 13 Nov 2026**)

Two build days, so the contract and the app are built **in parallel**: the app is built against the
IDL and a local Surfpool validator while the contract is still being finished.

**Wed 11 Nov (today, evening): setup + spikes**
- [ ] Install WSL2 Ubuntu → Rust → Agave/Solana CLI → AVM → Anchor 1.0.x; Surfpool
- [ ] Claude API key; Supabase project; devnet SOL
- [ ] `git init`; scaffold `anchor init heirloom` + Next.js app
- [ ] **Spike 1:** WDK creates a Solana wallet and sends test USD₮ on devnet
- [ ] **Spike 2:** an Anchor instruction is built with `@anchor-lang/core`, serialised, then signed and sent by WDK (R6)
- [ ] Script: devnet test USD₮ mint + car NFT mint + fund demo wallets

**Thu 12 Nov: contract + agent**
- [ ] Morning: estate, beneficiaries, payees, rules, deposit/withdraw, death flow (claim → attest → wait → veto → unlock)
- [ ] Afternoon: claims with caps; car listing, USD₮ offers, hardship, atomic `accept_offer`, refunds
- [ ] LiteSVM tests for every cap, floor and quorum check; deploy to devnet
- [ ] Agent: will writer (structured output), document reviewer, car valuer; API routes where the agent's WDK wallet signs

**Fri 13 Nov: UI + submit**
- [ ] Morning: owner, family, verifier and buyer screens wired to devnet
- [ ] Demo seed script (dad, 3 children, 3 verifiers, car, 2 buyers)
- [ ] Afternoon: deploy to Vercel; README ("Where Tether is used"); record the demo video; slides
- [ ] **Submit before the deadline**, then rehearse the live 3-minute demo

**Cut order if behind:** hardship flow UI (keep the contract + tests) → web-search car valuation (use a fixed asking price) → Supabase (keep files in memory, hashes on-chain) → verifier inbox polish.

## 11. Demo script (3 minutes)
1. Dad chats to the agent: "Pay my children's university fees up to R… a year, and sell my car for no less than 9,000 USDT unless one of them is in real need." The rules appear; he signs.
2. Funds the vault; registers the car title NFT.
3. A child uploads the death certificate; the agent flags nothing; 2 verifiers attest; the timer runs out; the vault unlocks.
4. Child 1 uploads a university fee statement and gets paid to the university wallet. Child 2 tries to overclaim and is **rejected by the contract**.
5. Buyers place offers; the agent accepts the best offer ≥ floor; USDT and the title swap in one transaction.
6. Replay: a low offer is blocked, then a hardship affidavit plus 2 verifiers lets it through, but not below the hardship floor.
