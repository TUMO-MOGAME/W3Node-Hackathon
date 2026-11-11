# Heirloom: demo video script (2:55, hard limit 3:00)

> Follows plan.md §11. Record at 1920×1080, browser zoom 110–125% so text is readable, and a clean
> browser profile (no bookmarks or other tabs). Seed the demo first (dad, 3 children, 3 verifiers, car,
> 2 buyers). Voice-over is recorded separately and laid over the screen capture. Speed up waits (2×–8×)
> and show a small "sped up" label so nobody thinks we hid anything.
>
> **Tether must be visible in every section:** the "USD₮" label next to every amount, the "Tether WDK"
> wallet badge on each role, and at least three Solana Explorer views of real USD₮ (SPL) transfers.

| Time | Shot (what's on screen) | Voice-over | On-screen caption |
|---|---|---|---|
| 0:00–0:12 | Title card: Heirloom logo; "Programmable estate trust · USD₮ on Solana · Tether WDK" | "When a South African parent dies, the estate can freeze for years. Two in three adults have no will. The money for school fees exists, but it can't reach the school." | "66% of South Africans have no will (Sanlam, 2025)" |
| 0:12–0:20 | Landing page → "Get started" → **WDK creates the owner's wallet** (seed shown blurred, address visible) | "Heirloom fixes that. Dad opens the app, and Tether's Wallet Development Kit creates his self-custodial wallet on his device. We never hold his keys." | "Self-custodial wallet: Tether WDK (`@tetherto/wdk-wallet-solana`)" |
| 0:20–0:45 | **Will-writer chat.** Dad types: "Pay my children's university fees up to R80,000 a year each, until 2032, and sell my car for no less than 9,000 USD₮ unless one of them is in real need." The agent replies with the rules card: beneficiaries, caps in USD₮ with the rand equivalent, car floor 9,000 USD₮, hardship floor, 3 verifiers | "He writes his wishes in plain language. The AI agent turns them into strict rules: caps per claim and per child, a floor price for the car, a hardship floor, and three verifiers, including his executor. Every amount is USD₮, with the rand value from a live South African exchange rate." | "AI writes the rules. The Solana program enforces them." |
| 0:45–0:55 | Dad clicks **Sign with WDK** → toast "Rules hash stored on-chain" → Explorer tab shows the transaction | "He signs with his WDK wallet. The rules' hash is stored on Solana, so they can't change after his death." | "Rules hash on-chain; personal data stays off-chain (POPIA)" |
| 0:55–1:08 | **Fund the vault**: deposit 25,000 USD₮ → vault balance updates → Explorer shows the USD₮ SPL transfer into the program-owned vault. **Register car**: the title NFT moves into the estate | "He funds the vault with USD₮. The vault belongs to the program, not to Heirloom, and only accepts the official USD₮ mint. He registers the car's digital title too." | "USD₮ vault controlled by the Solana program" |
| 1:08–1:35 | Switch role (WDK wallet badge: "Child 1"). **Upload death certificate** → agent report: fields extracted, no red flags. **Verifier inbox**: Verifier 1 (executor) and Verifier 2 attest. Countdown "Waiting period" (sped up) with an "I'm alive: veto" button visible on the owner's side → status **Unlocked** | "Later, his daughter uploads the death certificate. The agent checks it, but the agent can't unlock anything. Two of the three verifiers, including the executor, must attest. Then a waiting period runs, and the owner could veto at any time if this were fraud. Only then does the vault unlock." | "AI check + 2-of-3 verifiers + waiting period + owner veto" · "sped up" |
| 1:35–1:58 | **Tuition claim**: Child 1 uploads a university fee statement → agent: OK → verifier approves → **paid to the university's wallet** → Explorer shows USD₮ to the institution. Rand equivalent shown | "Child one uploads her fee statement. The agent reads it, a verifier approves, and the program pays the university directly in USD₮, never the child. In production, a licensed off-ramp turns this into a rand payment over PayShap." | "Paid to the institution, not the child" |
| 1:58–2:10 | **Overclaim**: Child 2 asks for more than the cap → transaction fails → error "Exceeds per-claim cap" from the program | "Child two tries to claim more than Dad allowed. The AI isn't what stops it: the smart contract rejects it." | "Rejected on-chain: exceeds cap" |
| 2:10–2:32 | **Car sale**: listing page (agent's suggested asking price); Buyer A offers 8,500 USD₮, Buyer B offers 9,400 USD₮ (both from WDK wallets, USD₮ escrowed) → the agent's own **WDK wallet** accepts B → one transaction: USD₮ to the estate, title NFT to Buyer B → Explorer | "Buyers make offers in USD₮ from their own WDK wallets. The agent, which has its own WDK wallet with limited powers, accepts the best offer above the floor. Money and title swap in a single transaction." | "Agent wallet (Tether WDK) · atomic USD₮ ↔ title swap" |
| 2:32–2:45 | **Hardship replay** (fast): a 7,000 USD₮ offer is blocked ("below floor") → Child 3 uploads a SAPS-commissioned affidavit → agent report + 2 verifiers approve → sale goes through at 7,000 but a 5,000 offer stays blocked ("below hardship floor") | "If a child is in real need, a sworn affidavit and two verifiers can allow a lower price, but never below the hardship floor Dad set." | "Hardship: affidavit + 2-of-3, floor still enforced" |
| 2:45–2:55 | Estate dashboard: every USD₮ movement listed with Explorer links; "Where Tether is used" panel. End card: "Heirloom. Your wishes, enforced." + live URL + GitHub | "Every dollar here moved as USD₮ and was signed by a Tether WDK wallet. Heirloom: your wishes, enforced. Your children, provided for." | URL · repo · "Devnet demo · not audited" |

## Recording checklist
- [ ] Demo seeded; all wallets funded with test USD₮ and devnet SOL (or gasless WDK)
- [ ] Waiting period set to 2 minutes; speed it up in the edit
- [ ] Explorer tabs pre-opened on the devnet cluster
- [ ] Rand rate visible (live feed) in at least two shots
- [ ] No real personal data in documents (use sample certificates marked "SAMPLE")
- [ ] Captions burned in (judges often watch muted)
- [ ] Optional: a 5-second insert of one **real mainnet USD₮ transfer** from a WDK wallet (plan.md §3.2b), labelled "mainnet"
- [ ] Final length checked: **≤ 3:00**
