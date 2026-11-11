# Heirloom: demo video script (2:58, hard limit 3:00)

> Updated 2026-11-12 for the chat-first shell: the app opens on the chat home (`/chat`), the sidebar holds the
> screens (Plan, Family, Trusted people, Money) and **Demo mode**, and "Needs your attention" cards drive the story.
> Button names below are the real labels from `app/src/content/*` and `app/src/lib/chat/nudge-copy.ts`.
> Record at 1920×1080 (or a 390×844 phone frame centred on a branded background), browser zoom 110–125%, a clean
> browser profile. Voice-over recorded separately. Speed up waits (2×–8×) and show a small **"sped up"** label.
> At widths under 400px the composer hides **Send money**, so record the chat shots at 400px or wider.
>
> **Three things the judges must see** (Tether brief):
> 1. **One payment from review to receipt**, with *Pending* turning into *Confirmed* (0:25–0:48).
> 2. **The contract blocking a rule break** (1:05–1:15, and again in the car sale).
> 3. **WDK + USD₮ proof on Solana Explorer** (0:44 and 2:44–2:56).
>
> **Label everything simulated on screen**: mock-mode receipts ("Simulated"), the ZAR settlement ("Simulated"),
> sped-up timers, the 60-second waiting period ("demo: 60 s, real: 30 days"), sample documents ("SAMPLE").
>
> **Which mode to record in.** The hosted site (heirloom-one-iota.vercel.app) runs in **mock mode** with no Gemini or
> ElevenLabs keys, so its agent answers are canned and its call is the "Simulated call preview". Record the
> **funding payment and the P2P send in chain mode** (`NEXT_PUBLIC_DATA_MODE=chain`, devnet, on a laptop), so their
> Explorer links are real. Record the chat and call shots with `GEMINI_API_KEY` (and the ElevenLabs keys) set, or
> change the 2:36 caption to say the answers are canned. If the rest of the story is recorded in mock mode for
> reliability, the "Demo mode" badge must be visible in those shots, and the final proof shot uses the real devnet
> links (program, estate, WDK USD₮ transfer). Never show a mock receipt as if it were on-chain.

| Time | Shot (what's on screen) | Voice-over | On-screen caption |
|---|---|---|---|
| 0:00–0:10 | Title card: Heirloom; "A living estate plan in USD₮ · Solana · Tether WDK" | "When a South African parent dies, the estate can freeze for a year or more. The money for school fees exists, but it can't reach the school." | "66% of South Africans have no will (Sanlam, 2025)" |
| 0:10–0:25 | Landing → **Try the demo** → **Start as Thabo** → the chat home opens. Demo guide bar "Thabo builds his family plan" → **Take me there** (or sidebar **Plan**). Tap a **Suggested reply**; the plan card fills in; flip one rule from **After I'm gone** to **Now** → **Review in plain language** → **Sign and lock** | "Thabo writes his plan with an AI agent, in plain words. Each rule can start now, while he's alive, or after he's gone. He signs it with his Tether WDK wallet." | "AI drafts the rules. The Solana program enforces them." |
| 0:25–0:48 | **Fund the vault** → **Add funds** 24,000 USD₮ → **Add to vault**. Hold on the **review sheet**: recipient (the family vault), amount in USD₮ **and rand**, network "Solana devnet", fee and who pays it, verified-token badge → **Approve** → "Signing with your Tether wallet (WDK)" → **Pending** → **Confirmed** → **Receipt** → Explorer opens on the transaction | "Every payment follows the same steps. Check the address, network and token. Check the balance and the fee. Review, then approve. WDK signs on his phone; the payment shows as pending until Solana confirms it. Here's the receipt on Explorer." | "Review → approve → WDK signs → pending → confirmed" |
| 0:48–0:58 | Back on the chat home (sidebar **Ask Heirloom**): the card **A payment is due today** (Lerato's books, 85 USD₮ to Van Schaik Bookstore) → **Pay it now** → confirmed | "The plan is already working. Lerato's monthly book allowance pays itself, straight to the bookstore, never as cash." | "Living plan: scheduled payment, 85 USD₮ (≈ R1,500)" · "demo interval: 60 s" |
| 0:58–1:05 | Sidebar **Car**: AI valuation → floor 9,000, hardship floor 7,000 → **Add car to the estate** | "He adds his car, with a floor price the estate may never sell below." | "Car floor: 9,000 USD₮" |
| 1:05–1:15 | Switch to **Lerato** (persona card at the bottom of the sidebar, or **Switch to Lerato** in the demo guide). Sidebar **Claims** → claim **5,000 USD₮** tuition to UCT → **Submit claim** → **Blocked by the contract** card (ExceedsPerClaimCap) with the next step | "Lerato asks for more than her father allowed. The AI didn't stop this. The smart contract did." | "Rejected on-chain: exceeds per-claim cap (4,000)" |
| 1:15–1:30 | Claim **3,200** + fee statement (SAMPLE) → agent report (fields, no red flags) → switch to **Thabo** → chat home card **A claim needs your approval** → **Review the claim** → **Approve and pay** → review → **Approve** → confirmed → ZAR settlement card with **"Simulated"** badge | "With the right amount, the agent checks her fee statement, Dad approves, and the program pays UCT directly. In production a licensed partner turns it into a rand payment." | "Paid to the institution, not the child" · "ZAR settlement: Simulated" |
| 1:30–1:47 | As **Lerato**: sidebar **Timeline** → **Report a passing** → death certificate (SAMPLE) → **Submit for review** → agent report → as a trusted person, card **A passing was reported** → **Review and confirm** (×2: executor + 1; or use **Demo mode** → **Simulate a passing**, which does the report and both confirmations in one step) → waiting period with Thabo's **I'm still here** button (sped up) → card **The estate can unlock** → **Unlock the estate** | "When Thabo passes, nothing unlocks on one document. The agent checks the certificate, two of three trusted people must confirm, and a waiting period lets the owner cancel any fraud. Then the same plan just keeps running." | "AI check + 2-of-3 trusted people + waiting period + owner veto" · "sped up · demo: 60 s" |
| 1:47–2:08 | As the executor: **Car** → **List the car for sale** → a low rival offer → the agent tries it → **Blocked: below the minimum** → as **Pieter**: **Make an offer** 9,400 USD₮ → **Put offer in escrow** (from his WDK wallet) → **Ask the agent to settle** (or the card **Settle the sale**) → **Sold** + handover pack | "Buyers escrow USD₮ from their own WDK wallets. A low offer is blocked by the contract. Pieter's 9,400 clears the floor, and the agent's own WDK wallet settles it: money and title swap in one transaction." | "Agent wallet (Tether WDK) · atomic USD₮ ↔ title swap" |
| 2:08–2:22 | **Hardship replay** (fast; **Demo mode** → **Car listed, only low offers**): sidebar **Hardship** → SAPS affidavit (SAMPLE) → **Submit request** → agent report → 2 trusted people approve (card **A hardship request needs you** → **Review the request**) → settles above the 7,000 hardship floor | "If a child is in real need, a sworn affidavit and two trusted people can allow a lower price, but never below the hardship floor Dad set." | "Hardship: affidavit + 2-of-3 · floor still enforced" · "sped up" |
| 2:22–2:36 | Chat home → **Send money** (the composer fills "Send R500 to ") → type "Lerato for books" → send → the reply shows the engine badge → **Review payment to Lerato** → review sheet (fee, network, verified USD₮) → **Approve** → **Pending**; toggle the network off → offline bar "re-checking" → back online → **Confirmed**, no second payment | "Heirloom is also a family wallet. Sending money home works the same way. If the connection drops, the app re-checks the same payment when it's back. Nobody pays twice." | "P2P USD₮ · pay-once on reconnect" |
| 2:36–2:44 | Chat home: type "How much can Lerato still claim?" → answer tagged **Claims guide**; tap the phone button (**Call Heirloom**) for 2–3 s of the voice reply | "And anyone in the family can just ask, by text or by voice." | "Gemini orchestrator + 6 specialists · ElevenLabs voice" |
| 2:44–2:56 | Sidebar **Proof** → program id, estate, USD₮ mint → Explorer: the program, then a **WDK-signed USD₮ transfer** on devnet | "Every dollar here moved as USD₮, signed by a Tether WDK wallet, under rules a Solana program enforces. You can check every one." | "Solana devnet · test USD₮ mint · not audited" |
| 2:56–2:58 | End card: "Heirloom. Your wishes, enforced." + live URL + GitHub | "Heirloom: your wishes, enforced." | URL · repo |

## Recording checklist
- [ ] Decide the mode per shot (see the note at the top); chain-mode shots seeded and funded (`scripts/seed-demo.ts`)
- [ ] `NEXT_PUBLIC_DEMO_WAITING_SECS=60` and `NEXT_PUBLIC_DEMO_INTERVAL_SECS=60`; speed up waits in the edit with a "sped up" label
- [ ] In mock mode, **Demo mode** → demo controls can jump the story (**Will signed, vault funded**, **Estate unlocked**, **Car listed with offers**, **Car listed, only low offers**) and the shortcuts (**Simulate a passing**, **Skip the waiting period**, **Make scheduled payments due**)
- [ ] Explorer tabs pre-opened on devnet: program, demo estate, a WDK USD₮ transfer, the funding tx from this recording
- [ ] Rand amounts visible (live VALR rate) in at least two shots
- [ ] "Simulated" badges visible on the ZAR settlement and on any mock-mode receipt
- [ ] Sample documents marked "SAMPLE"; no real personal data
- [ ] For the offline beat: DevTools → Network → Offline (or airplane mode on the phone), then back online
- [ ] Captions burned in (judges often watch muted)
- [ ] Final length checked: **≤ 3:00**; uploaded as public/unlisted with link access for anyone
