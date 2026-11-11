# Heirloom: architecture

> Companion to the [README](../README.md). The on-chain contract is specified in [`program-spec.md`](program-spec.md);
> this file explains how the pieces talk to each other, with a sequence diagram for every money path.
> Paths are relative to the repo root.

## 1. Components

| Layer | What | Where |
|---|---|---|
| **PWA (browser / phone)** | Next.js 16 App Router, React 19, Tailwind 4. Installable (manifest + service worker), offline page | `app/src/app/`, `app/src/app/manifest.ts`, `app/public/sw.js`, `app/src/components/shell/service-worker.tsx` |
| **Screens** | Estate, plan builder (will), vault, claims, car, hardship, people, inbox (verifiers), family, send (P2P), start | `app/src/components/screens/*.tsx` |
| **One payment sheet** | Review → Approve/Cancel → Signing (WDK) → Pending → Confirmed, for every USD₮ movement | `app/src/components/pay/payment.tsx` |
| **Service interface** | One `HeirloomService` with two implementations: `mock` (in-browser, default) and `chain` (Solana + WDK) | `app/src/lib/service/{types,index,mock,chain}.ts` |
| **Wallets** | Tether WDK (`@tetherto/wdk-wallet-solana`), PIN-encrypted seed in localStorage, active-signer singleton | `app/src/lib/wallet/{wdk,crypto,store,signer,context}.ts(x)` |
| **Pay-once pipeline** | Sign → persist signature → broadcast → re-check; resume on reconnect | `app/src/lib/wallet/payments.ts` (+ `payments.test.ts`) |
| **Chain client** | IDL-driven instruction builders (accounts resolved by name), PDAs, decoders, unsigned tx builder | `app/src/lib/chain/{instructions,pda,decoders,reads,tx,client,config}.ts`, `idl/heirloom.json` |
| **API routes** | Agent orchestrate, document review, valuation, offers, list/accept, scheduler tick, FX, off-ramp, reports, estate metadata, voice session | `app/src/app/api/**/route.ts`, shared guards in `app/src/lib/api/http.ts` |
| **AI agent** | Gemini orchestrator (forced `route_to` function call; keyword fallback) + 6 specialists with zod-typed tools | `app/src/lib/agent/{orchestrator,specialists,prompts,gemini,will,review,offers,valuation,facts}.ts` |
| **Agent wallet** | Server-side WDK wallet; allow-list `review_death`, `review_claim`, `review_hardship`, `list_asset`, `accept_offer`, `execute_scheduled` | `app/src/lib/agent/agent-wallet.ts` |
| **Scheduler** | Finds due recurring rules, calls `execute_scheduled` (agent pays only the fee) | `app/src/lib/server/scheduler.ts`, `POST /api/scheduler/tick`, `scripts/run-scheduler.ts` |
| **Voice** | ElevenLabs Agents Platform; webhook tool `heirloom_orchestrate` → our orchestrator; client tools → UI actions | `app/src/lib/voice/useHeirloomVoice.ts`, `app/src/app/api/voice/session/route.ts`, `scripts/elevenlabs-agent.md` |
| **Off-chain data** | Supabase Postgres (names, will drafts, full agent reports, transcripts) + private `evidence` bucket; in-memory fallback | `app/src/lib/{db,storage,supabase}.ts`, `supabase/migrations/0001_init.sql` |
| **FX** | VALR public USDT/ZAR market summary, mid price, 60 s cache, labelled fallback | `app/src/lib/fx.ts`, `/api/fx` |
| **ZAR off-ramp** | `SimulatedZarPayout`: describes the PayShap/EFT payout a licensed partner would make. **Simulated** | `app/src/lib/offramp.ts`, `/api/offramp` |
| **Program** | Anchor 1.2.2, 27 instructions, 25 LiteSVM tests | `programs/heirloom/src/**`, `programs/heirloom/tests/heirloom.rs` |

```mermaid
flowchart TB
  subgraph Browser["PWA"]
    S["Screens"] --> PAY["Payment sheet"]
    S --> SVC{"HeirloomService"}
    PAY --> SVC
    SVC -->|mock| MOCK["mock.ts<br/>in-memory estate"]
    SVC -->|chain| CH["chain.ts"]
    CH --> IX["chain/instructions.ts<br/>(IDL)"]
    CH --> PIPE["wallet/payments.ts<br/>pay-once"]
    PIPE --> WDK["WDK account<br/>(device keys)"]
  end
  WDK -->|signed tx| RPC["Solana devnet RPC"]
  RPC --> PROG["Heirloom program"]
  S -->|fetch| API["Next.js API routes"]
  API --> ORCH["Orchestrator"] --> SPEC["Specialists"] --> GEM["Gemini"]
  API --> AGW["Agent WDK wallet"] -->|allow-listed tx| RPC
  API --> DB[("Supabase")]
  API --> VALR["VALR ticker"]
  EL["ElevenLabs"] -->|webhook| ORCH
  S -->|WebRTC / WS| EL
```

## 2. Trust boundaries

| Actor | Can | Cannot |
|---|---|---|
| Owner (WDK on device) | Create estate, rules, payees; deposit/withdraw while Active; approve living-plan claims; veto a death claim | Pay a claim the agent rejected; change rules after unlock |
| Beneficiary | Submit claims, a death claim, a hardship request | Choose the payee kind, exceed caps, get cash |
| Verifier (×3) | Attest death, approve claims after unlock, approve hardship, list an asset | Act alone below the threshold; approve living-plan claims while the owner is alive |
| AI agent (server WDK) | Approve/reject document reviews, list and settle the car sale, trigger due scheduled payments | Move vault money by itself, sign anything outside its allow-list, sell below the floor |
| Anyone | `finalize_unlock` after the waiting period, `execute_claim` once approved, `execute_scheduled` once due | Change where the money goes: the program decides the recipient |
| Heirloom (the company) | Host the app and the agent | Hold user keys, read documents on-chain (only hashes are there) |

## 3. Living-plan scheduled payment

A `starts_now` rule with `recurring_amount > 0` pays a fixed payee (here: the bookstore) every interval while the owner
is alive, and keeps doing so after unlock. The demo uses a 60 s interval and a manual **Pay now** button; in production
Vercel Cron calls the tick.

```mermaid
sequenceDiagram
  autonumber
  actor Thabo as Thabo (owner, WDK)
  participant App as PWA
  participant P as Heirloom program
  participant Tick as /api/scheduler/tick
  participant AW as Agent WDK wallet
  participant Book as Bookstore wallet

  Thabo->>App: Plan builder: "85 USD₮ a month for Lerato's books" (Now)
  App->>Thabo: Review rule (amount, payee, interval, caps)
  Thabo->>P: add_rule(starts_now, recurring 85, interval, first_due, payee=Bookstore) [WDK-signed]
  P-->>App: Rule PDA (fixed_payee, next_due)
  loop every tick (Cron / run-scheduler.ts / "Pay now")
    Tick->>Tick: runDueSchedules(): isDue(rule, estate status, now)?
    Tick->>AW: build execute_scheduled (allow-listed)
    AW->>P: execute_scheduled [agent pays only the fee]
    P->>P: recurring>0, Active&starts_now or Unlocked,<br/>now ≥ next_due, now ≤ valid_until,<br/>spent+85 ≤ lifetime_cap
    alt all checks pass
      P->>Book: 85 USD₮ vault → ATA(fixed_payee) (PDA-signed transfer_checked)
      P-->>Tick: ScheduledPaid(next_due += interval)
    else not due / cap reached / expired
      P-->>Tick: NotDue / ExceedsLifetimeCap / RuleExpired (nothing moves)
    end
  end
  App->>App: Receipt pending → confirmed, Explorer link
```

Why it is safe: the keeper (agent or anyone) only chooses *when* to call; amount and recipient are stored in the rule.
Wrong timing just fails. Code: `app/src/lib/server/scheduler.ts` (`isDue` mirrors the program), test
`scheduled_payment_pays_when_due_and_stops_at_lifetime_cap`, `scheduled_payment_waits_for_unlock_unless_starts_now`.

## 4. Claim with AI review and a contract cap

```mermaid
sequenceDiagram
  autonumber
  actor Lerato as Lerato (beneficiary, WDK)
  participant App as PWA
  participant API as /api/review
  participant DR as DocumentReviewer (Gemini)
  participant SB as Supabase
  participant AW as Agent WDK wallet
  participant P as Heirloom program
  actor Thabo as Thabo (owner) / verifiers
  participant UCT as UCT wallet

  Lerato->>App: Claim 5,000 USD₮ tuition → UCT
  App->>P: submit_claim(5,000, evidence_hash) [WDK-signed]
  P-->>App: Rejected: ExceedsPerClaimCap (cap 4,000)
  App->>Lerato: "Blocked by the contract" + what to do next
  Lerato->>App: Claim 3,200 USD₮ + fee statement (PDF)
  App->>P: submit_claim(3,200, sha256(fee statement))
  P-->>App: Claim PDA (Open, verdict Pending)
  App->>API: upload document (purpose=claim)
  API->>SB: store file in private bucket
  API->>DR: document as data (+ claim context)
  DR-->>API: report {verdict, extracted fields, red flags, confidence}
  API->>SB: save full report
  API->>AW: review_claim(approve, report_hash)
  AW->>P: review_claim [allow-listed]
  App->>Thabo: Agent report card
  alt Estate Active (living plan, starts_now)
    Thabo->>P: owner_approve_claim [WDK]
  else Estate Unlocked
    Thabo->>P: approve_claim ×claim_threshold (verifiers)
  end
  Thabo->>App: Pay (payment sheet: review → approve)
  App->>P: execute_claim
  P->>P: re-check status, verdict, approvals,<br/>lifetime cap, valid_until
  P->>UCT: 3,200 USD₮ vault → UCT ATA
  App->>App: Pending → Confirmed (Explorer)
  App->>API: /api/offramp quote → "R… to UCT via PayShap" (SIMULATED)
```

The AI never decides alone and never moves money: a rejected review blocks payment (`AgentNotApproved`), and an
approved one still needs the owner or the quorum. Tests: `claim_over_per_claim_cap_fails`,
`lifetime_cap_rechecked_at_execution`, `claim_to_wrong_payee_kind_fails`, `living_plan_claim_needs_owner_approval_while_active`.

## 5. Death and unlock

```mermaid
sequenceDiagram
  autonumber
  actor Ben as Beneficiary
  participant API as /api/review
  participant AW as Agent WDK wallet
  participant P as Heirloom program
  actor V1 as Verifier 1 (executor)
  actor V2 as Verifier 2
  actor Owner as Owner
  actor Any as Anyone

  Ben->>P: submit_death_claim(sha256(certificate)) [WDK]
  Ben->>API: upload certificate (purpose=death)
  API->>AW: DocumentReviewer verdict → review_death(approve, report_hash)
  AW->>P: review_death
  V1->>P: attest_death
  V2->>P: attest_death (reaches death_threshold = 2)
  P->>P: status = DeathPending, timer starts
  opt owner is alive (fraud)
    Owner->>P: veto_death → Active, claim cleared
  end
  Note over P: waiting period (60 s demo, weeks in production)
  Any->>P: finalize_unlock
  P->>P: now ≥ pending_since + waiting → Unlocked
  Note over P: Rules keep running. Claims now need<br/>agent + verifier quorum, scheduled payments continue
```

Four independent locks: AI check, 2-of-3 humans, a timer, an owner veto. Tests:
`death_flow_unlocks_after_quorum_and_waiting_period`, `veto_resets_death_claim`, `agent_rejection_clears_death_claim`,
`owner_cannot_approve_after_unlock`.

## 6. Car sale with floor and hardship

```mermaid
sequenceDiagram
  autonumber
  participant AW as Agent WDK wallet (CarBroker)
  participant P as Heirloom program
  actor Low as Rival buyer
  actor Pieter as Pieter (buyer, WDK)
  actor Ben as Beneficiary in hardship
  actor V as Verifiers

  Note over P: register_asset (owner, while alive):<br/>floor 9,000 · hardship floor 7,000 · asking 10,500<br/>title NFT → estate escrow
  AW->>P: list_asset(duration) [after unlock]
  Low->>P: place_offer(low amount) → USD₮ into offer escrow
  Pieter->>P: place_offer(9,400) → USD₮ into offer escrow
  AW->>AW: rankOffers() + explanation
  AW->>P: accept_offer(low offer)
  P-->>AW: Rejected: BelowFloor
  AW->>P: accept_offer(Pieter)
  P->>P: 9,400 ≥ floor 9,000
  P-->>Pieter: title NFT (atomic)
  P-->>P: 9,400 USD₮ → proceeds_to (estate vault)
  Note over P: Asset Sold → handover pack (eNaTIS tasks)

  rect rgba(200,160,60,0.12)
  Note over Ben,V: Hardship replay
  Ben->>P: submit_hardship(sha256(SAPS affidavit))
  AW->>P: review_hardship(approve, report_hash)
  V->>P: approve_hardship ×2 → hardship_beneficiary = Ben
  AW->>P: accept_offer(offer between 7,000 and 9,000)
  P->>P: amount ≥ hardship_floor 7,000
  P-->>Ben: USD₮ to the hardship beneficiary, NFT to buyer
  end
  Low->>P: withdraw_offer (losing offers refund themselves)
```

Tests: `offer_below_floor_rejected_and_best_offer_settles_atomically`,
`hardship_approved_allows_hardship_floor_and_pays_hardship_beneficiary`, `offer_below_hardship_floor_rejected`,
`withdraw_offer_refunds_buyer`, `offers_after_listing_end_rejected`.

## 7. P2P "Send to family" with pay-once resume

This is the Tether brief's flow end to end, including the poor-connection case.

```mermaid
sequenceDiagram
  autonumber
  actor Thabo as Sender (WDK)
  participant UI as Send screen + payment sheet
  participant SVC as chain.ts
  participant WDK as WDK account
  participant LS as localStorage receipts
  participant RPC as Solana RPC

  Thabo->>UI: pick saved recipient (e.g. Mom), amount
  UI->>SVC: reviewSend(to, amount)
  SVC->>RPC: mint exists, 6 decimals, = configured USD₮?
  SVC->>WDK: getTokenBalance, getBalance, quoteTransfer (read-only)
  SVC-->>UI: review {recipient, USD₮ + ZAR, network, fee + payer, warnings}
  alt Cancel
    Thabo->>UI: Cancel → nothing signed
  else Approve
    Thabo->>UI: Approve
    UI->>SVC: confirmSend(review) → runPayment(id)
    SVC->>WDK: sign only (create ATA idempotent + transfer_checked)
    WDK-->>SVC: signature + signed bytes
    SVC->>LS: save {id, signature, bytes, lastValidBlockHeight} BEFORE broadcast
    SVC->>RPC: broadcast
    UI->>Thabo: Pending
  end
  Note over UI,RPC: connection drops / app closes
  UI->>SVC: on reload, "online", tab visible → resumeOnReconnect()
  SVC->>RPC: getSignatureStatus(signature)
  alt confirmed
    SVC->>LS: status confirmed → Receipt + Explorer
  else unknown and blockhash still valid
    SVC->>RPC: re-broadcast the SAME bytes (cannot pay twice)
  else unknown and blockhash expired
    SVC->>LS: failed: "not paid, safe to try again"
  else network error in tx
    SVC->>LS: failed: "nothing was paid"
  end
```

Invariant: a payment id with a signature is never re-signed, so a retry can only re-send the identical transaction.
Unit tests in `app/src/lib/wallet/payments.test.ts`.

## 8. Agent: orchestrator and specialists

```mermaid
sequenceDiagram
  autonumber
  actor U as User (chat) / caller (voice)
  participant EL as ElevenLabs agent
  participant O as /api/agent/orchestrate
  participant G as Gemini (route_to)
  participant S as Specialist
  participant App as PWA

  alt text chat
    U->>O: message + persona + page + estate
  else voice call
    U->>EL: speech
    EL->>O: webhook heirloom_orchestrate (x-heirloom-tool-secret)
  end
  O->>G: forced function call route_to(specialist)
  G-->>O: e.g. ClaimsGuide (keyword router if Gemini fails)
  O->>S: history + on-chain facts (lib/agent/facts.ts)
  S->>S: tool loop ≤ 4 rounds (zod-validated tools)
  S-->>O: {reply, actions[], needsHuman[]}
  O-->>U: reply (spoken by ElevenLabs on a call)
  O-->>App: UI actions (navigate, openClaimForm, showRule, startUpload)
```

| Specialist | Job | Tools / code |
|---|---|---|
| WillWriter | Plain-language wishes → `WillDraft` (beneficiaries, verifiers, rules Now/After, car floors) | `lib/agent/will.ts` |
| DocumentReviewer | Death certificate / fee statement / affidavit → verdict + report hash | `lib/agent/review.ts` |
| ClaimsGuide | "How much can I claim?" from on-chain caps; prefilled claim form | `lib/agent/facts.ts` (`checkClaim`) |
| CarBroker | Valuation, asking price, offer ranking | `lib/agent/valuation.ts`, `offers.ts` |
| EstateGuide | Status, "why was this blocked?", next steps | `lib/agent/explain.ts` |
| Compliance | POPIA, Wills Act, FSCA questions; never legal advice | `lib/agent/prompts.ts` |

## 9. Data placement

| Data | Where | Why |
|---|---|---|
| Money, rules, caps, approvals, statuses | Solana program accounts | Enforced and auditable |
| SHA-256 of documents and agent reports | Solana | Proves the document/report wasn't changed, without revealing it |
| Documents (certificates, statements, affidavits) | Supabase private bucket | POPIA: personal information off-chain |
| Full agent reports, display names, transcripts | Supabase Postgres (RLS on, service role only) | Needed by the UI, not by the contract |
| Seed phrases | User's device only, PIN-encrypted | Self-custody |
| Pending payment receipts | Device localStorage | Pay-once resume without a server |
