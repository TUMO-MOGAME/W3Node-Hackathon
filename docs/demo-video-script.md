# Heirloom: demo video script (2:58, hard limit 3:00)

> Updated 2026-11-11 for the final click-path (living plans, the Tether payment flow, Send to family, voice).
> Record at 1920×1080 (or a 390×844 phone frame centred on a branded background), browser zoom 110–125%, a clean
> browser profile. Voice-over recorded separately. Speed up waits (2×–8×) and show a small **"sped up"** label.
>
> **Three things the judges must see** (Tether brief):
> 1. **One payment from review to receipt**, with *Pending* turning into *Confirmed* (0:25–0:48).
> 2. **The contract blocking a rule break** (1:05–1:15, and again in the car sale).
> 3. **WDK + USD₮ proof on Solana Explorer** (0:44 and 2:44–2:56).
>
> **Label everything simulated on screen**: mock-mode receipts ("Simulated"), the ZAR settlement ("Simulated"),
> sped-up timers, the 60-second waiting period ("demo: 60 s, real: weeks"), sample documents ("SAMPLE").
>
> **Which mode to record in.** Record the **funding payment and the P2P send in chain mode** (`NEXT_PUBLIC_DATA_MODE=chain`,
> devnet), so their Explorer links are real. If the rest of the story is recorded in mock mode for reliability, the
> "Simulated" badge must be visible in those shots, and the final proof shot uses the real devnet links (program,
> estate, WDK USD₮ transfer). Never show a mock receipt as if it were on-chain.

| Time | Shot (what's on screen) | Voice-over | On-screen caption |
|---|---|---|---|
| 0:00–0:10 | Title card: Heirloom; "A living estate plan in USD₮ · Solana · Tether WDK" | "When a South African parent dies, the estate can freeze for a year or more. The money for school fees exists, but it can't reach the school." | "66% of South Africans have no will (Sanlam, 2025)" |
| 0:10–0:25 | Landing → **Try the demo** → **Start as Thabo** (WDK wallet badge). **Plan builder**: tap a suggested reply; the agent drafts rules; flip one rule's **Now / After** toggle; **Sign and lock** | "Thabo writes his plan with an AI agent, in plain words. Each rule can start now, while he's alive, or after he's gone. He signs it with his Tether WDK wallet." | "AI drafts the rules. The Solana program enforces them." |
| 0:25–0:48 | **Fund vault 24,000 USD₮**. Hold on the **review sheet**: recipient (estate vault), amount in USD₮ **and rand**, network "Solana devnet", fee and who pays it, verified-token badge → **Approve** → "Signing with your Tether wallet (WDK)" → **Pending** → **Confirmed** → tap the receipt → Explorer opens on the transaction | "Every payment follows the same steps. Check the address, network and token. Check the balance and the fee. Review, then approve. WDK signs on his phone; the payment shows as pending until Solana confirms it. Here's the receipt on Explorer." | "Review → approve → WDK signs → pending → confirmed" |
| 0:48–0:58 | **Scheduled payments** → Lerato's book allowance → **Pay now** (85 USD₮ to the bookstore) → confirmed | "The plan is already working. Lerato's monthly book allowance pays itself, straight to the bookstore, never as cash." | "Living plan: scheduled payment, 85 USD₮ (≈ R1,500)" · "demo interval: 60 s" |
| 0:58–1:05 | **Car**: AI valuation card → **Add car** (floor 9,000, hardship floor 7,000) | "He adds his car, with a floor price the estate may never sell below." | "Car floor: 9,000 USD₮" |
| 1:05–1:15 | Switch persona → **Lerato**. **Claim 5,000 USD₮** tuition to UCT → **Blocked by the contract: ExceedsPerClaimCap** card, with the next step | "Lerato asks for more than her father allowed. The AI didn't stop this. The smart contract did." | "Rejected on-chain: exceeds per-claim cap (4,000)" |
| 1:15–1:30 | Claim **3,200** + fee statement (SAMPLE) → **agent report** (fields, no red flags) → switch to **Thabo** → **Approve and pay** → review → approve → confirmed → ZAR settlement card with **"Simulated"** badge | "With the right amount, the agent checks her fee statement, Dad approves, and the program pays UCT directly. In production a licensed partner turns it into a rand payment." | "Paid to the institution, not the child" · "ZAR settlement: Simulated" |
| 1:30–1:47 | Demo controls → **Simulate a passing** → death certificate (SAMPLE) → agent check → **2 verifiers confirm** (executor + 1) → waiting period countdown with the owner's **veto** button (sped up) → **Unlocked** | "When Thabo passes, nothing unlocks on one document. The agent checks the certificate, two of three verifiers must confirm, and a waiting period lets the owner veto any fraud. Then the same plan just keeps running." | "AI check + 2-of-3 verifiers + waiting period + owner veto" · "sped up · demo: 60 s" |
| 1:47–2:08 | **List car** → a low rival offer → agent tries it → **Blocked: BelowFloor** → **Pieter offers 9,400 USD₮** (escrowed from his WDK wallet) → the agent settles → **Sold** + handover pack | "Buyers escrow USD₮ from their own WDK wallets. A low offer is blocked by the contract. Pieter's 9,400 clears the floor, and the agent's own WDK wallet settles it: money and title swap in one transaction." | "Agent wallet (Tether WDK) · atomic USD₮ ↔ title swap" |
| 2:08–2:22 | **Hardship replay** (fast): offer below floor → **BelowFloor** → a child uploads a SAPS affidavit (SAMPLE) → agent report → **2 verifiers approve** → settles above the 7,000 hardship floor | "If a child is in real need, a sworn affidavit and two verifiers can allow a lower price, but never below the hardship floor Dad set." | "Hardship: affidavit + 2-of-3 · floor still enforced" · "sped up" |
| 2:22–2:36 | **Send to family**: pick a saved recipient → amount → review (fee, network, verified USD₮) → approve → **Pending**; toggle the network off → offline bar "re-checking" → back online → **Confirmed**, no second payment | "Heirloom is also a family wallet. Sending money home works the same way. If the connection drops, the app re-checks the same payment when it's back. Nobody pays twice." | "P2P USD₮ · pay-once on reconnect" |
| 2:36–2:44 | **Ask Heirloom** chat: "How much can Lerato still claim?" → ClaimsGuide answer; tap **Call** (2–3 s of the voice reply) | "And anyone in the family can just ask, by text or by voice." | "Gemini orchestrator + 6 specialists · ElevenLabs voice" |
| 2:44–2:56 | **Proof drawer** → program id, estate, USD₮ mint → Explorer: the program, then a **WDK-signed USD₮ transfer** on devnet | "Every dollar here moved as USD₮, signed by a Tether WDK wallet, under rules a Solana program enforces. You can check every one." | "Solana devnet · test USD₮ mint · not audited" |
| 2:56–2:58 | End card: "Heirloom. Your wishes, enforced." + live URL + GitHub | "Heirloom: your wishes, enforced." | URL · repo |

## Recording checklist
- [ ] Decide the mode per shot (see the note at the top); chain-mode shots seeded and funded (`scripts/seed-demo.ts`)
- [ ] `NEXT_PUBLIC_DEMO_WAITING_SECS=60` and `NEXT_PUBLIC_DEMO_INTERVAL_SECS=60`; speed up waits in the edit with a "sped up" label
- [ ] Explorer tabs pre-opened on devnet: program, demo estate, a WDK USD₮ transfer, the funding tx from this recording
- [ ] Rand amounts visible (live VALR rate) in at least two shots
- [ ] "Simulated" badges visible on the ZAR settlement and on any mock-mode receipt
- [ ] Sample documents marked "SAMPLE"; no real personal data
- [ ] For the offline beat: DevTools → Network → Offline (or airplane mode on the phone), then back online
- [ ] Captions burned in (judges often watch muted)
- [ ] Final length checked: **≤ 3:00**; uploaded as public/unlisted with link access for anyone
