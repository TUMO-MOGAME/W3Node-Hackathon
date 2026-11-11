# Heirloom: BuilderBase submission

> Deadline: **Fri 13 Nov 2026, 23:59 SAST** on BuilderBase. Copy each field below as-is. Replace every
> `<!-- ... -->` placeholder first. Character and word counts are noted so nothing gets cut off.

## Fields

### Project title
```
Heirloom
```

### Tagline (≤ 100 characters)
```
A living estate plan in USD₮: pay your kids' fees now and after you're gone, enforced on Solana.
```
*(96 characters)*

### Track
```
Tether: Mobile Money & Peer-to-Peer
```

### Description (≤ 300 words)
```
When a South African parent dies, the estate freezes for a year or more, and 66% of adults have no will. The money for school fees exists, but it can't reach the school, and when it finally arrives as a lump sum nothing makes sure it is spent on the children.

Heirloom is a living estate plan in USD₮. A parent writes their wishes in plain language with an AI agent (a Gemini orchestrator with six specialists, also reachable by an ElevenLabs voice call). The agent turns them into strict rules: who gets what, for which purpose, paid to which institution, within per-claim and lifetime caps. The money sits in a USD₮ vault controlled by our Solana program, and everyone, including the AI agent, uses a self-custodial Tether WDK wallet.

The plan starts today. A monthly book allowance pays the bookstore automatically; a daughter claims her university fees, the AI checks the fee statement, the parent approves, and the program pays the university, never cash. Ask for more than the cap and the contract refuses. After death (AI check, two of three verifiers including the executor, a waiting period with an owner veto), the same plan keeps running. The car sells only at or above the owner's floor price, with USD₮ and title swapped atomically.

Every USD₮ movement, including a "Send to family" P2P transfer, follows Tether's payment flow: address, network and token checks; balance and fee quote; review; approve; WDK signs; pending until confirmed. Payments are signed once and re-checked on reconnect, so nobody pays twice.

Built during the hackathon: 27-instruction Anchor program on devnet (25 tests), a Next.js PWA (230 tests), and real WDK-signed USD₮ transfers on devnet. The rand settlement to institutions is simulated and labelled.
```
*(about 290 words; recount after any edit with `wc -w`)*

### How it fits the Tether track
```
Heirloom is mobile money for families, built on USD₮ and Tether WDK. Every role in the app has a self-custodial WDK wallet on their own phone (the PWA installs like an app): parent, children, verifiers, buyers, and even the AI agent, whose wallet may only sign an allow-list of instructions. Every USD₮ movement, whether a P2P "Send to family" transfer, a vault deposit, a scheduled allowance, a tuition payout or a car-sale escrow, goes through one payment sheet that follows the flow from the track brief: check the address, network and USD₮ mint; read the balance and get a WDK fee quote; show recipient, amount (in USD₮ and rand), fee and network; approve or cancel; WDK signs; show pending until Solana confirms; then a receipt with an Explorer link. For poor connections we sign first, store the signature on the device, then broadcast, and re-check that same transaction on reconnect, so a payment can never be made twice. When something goes wrong (for example a claim above the cap) the contract's error is shown in plain language with the next step, and everything simulated is labelled on screen.
```

### Tech stack
```
- Tether WDK (@tetherto/wdk-wallet-solana) for every wallet, including the AI agent's
- USD₮ (SPL token, 6 decimals) on Solana devnet
- Solana program: Rust, Anchor 1.2.2; LiteSVM tests
- Next.js 16 (App Router) PWA, React 19, Tailwind CSS 4, TypeScript, Motion
- @anchor-lang/core, @solana/web3.js, @solana/spl-token, @solana/kit
- Google Gemini (@google/genai): orchestrator + 6 specialist agents with typed function calling
- ElevenLabs Agents Platform (@elevenlabs/react) for voice calls
- Tether QVAC (@qvac/sdk, optional, runs locally) for the on-device "Ask your wallet" payment parser; a labelled fallback parser on the hosted demo
- Supabase (Postgres + private storage) for off-chain metadata and documents; only SHA-256 hashes on-chain
- VALR public API for the live USD₮/ZAR rate
- Zod, Vitest, Vercel
```

### Links
| Field | Value |
|---|---|
| GitHub repo (public) | https://github.com/TUMO-MOGAME/W3Node-Hackathon |
| Live demo (mock mode: simulated in the browser, labelled) | https://heirloom-one-iota.vercel.app |
| Demo video (≤ 3 min) | <!-- VIDEO_URL --> |
| Program on Solana Explorer (devnet) | https://explorer.solana.com/address/b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY?cluster=devnet |
| Example WDK-signed USD₮ transfer | https://explorer.solana.com/tx/nNUMsVDqmAbHxKYqTVXz1kggi2wfYXJawGod7gsXFpsysXFxBpnKG1vdL7m26UCm7hxwLc7cnDxpD6DvBEpKSCj?cluster=devnet |
| Demo estate | https://explorer.solana.com/address/JBdsDy67YBfpV8YAc2H1h7w95h8uJ2XUzTDh9vt34G9E?cluster=devnet |

### Team
```
Solo: Tumo Mogame (founder: product, design, full-stack, Solana program)
```

### Pre-existing code
```
None. All code was written during the hackathon (10–13 November 2026). It uses the open-source libraries listed in the README.
```

## Pre-submission checklist (do in order, Friday afternoon)

**Repo**
- [ ] Repo is **public** (github.com/TUMO-MOGAME/W3Node-Hackathon); open it in a private window while logged out
- [ ] `README.md` renders: Mermaid diagram draws, tables fit, no broken links (click every Explorer link)
- [ ] `<!-- VIDEO_URL -->` replaced in README and here (the live URL and team are already filled)
- [ ] `LICENSE` present (MIT, 2026 Tumo Mogame)
- [ ] Final commit pushed to `main`; commit author is the right identity

**No secrets in the repo**
- [ ] `git ls-files | grep -Ei "\.env|keypair|id\.json|demo-wallets|seed"` returns only `app/.env.example`
- [ ] Search history too: `git log -p | grep -Ei "SEED_PHRASE=|API_KEY=|SERVICE_ROLE_KEY=" ` shows only empty example lines
- [ ] `target/deploy/heirloom-keypair.json` and `scripts/.demo-wallets.json` are **not** tracked (but keep local copies)
- [ ] If anything leaked: rotate that key (Gemini, ElevenLabs, Supabase, agent seed) before submitting; deleting the file is not enough

**Live URL**
- [ ] Opens on a real phone (360 px): no sideways scroll, menu and all buttons work by touch
- [ ] "Try the demo → Start as Thabo" runs the whole story without errors
- [ ] Chain mode (if deployed that way): one real payment goes review → pending → confirmed and the Explorer link opens
- [ ] Voice call: works, or shows the labelled fallback (no dead button)
- [ ] Install as app (Add to Home Screen) works on Android Chrome and iOS Safari

**Video**
- [ ] ≤ 3:00; shows one payment from review to receipt, a contract block, and WDK/USD₮ proof on Explorer
- [ ] Simulated parts labelled on screen
- [ ] Link permission: **public or unlisted, anyone with the link can view** (test in a logged-out private window)

**BuilderBase form**
- [ ] Title, tagline (≤ 100 chars), description (≤ 300 words), track = Tether, tech stack, links, team, pre-existing code
- [ ] Submitted before **23:59 SAST Fri 13 Nov**; screenshot of the confirmation saved
