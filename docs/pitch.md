# Heirloom: 5-minute pitch + Q&A prep

> Live judging, Sat 14 Nov 2026: **5:00 pitch + 3:00 Q&A**. Rehearse with a timer at least 3 times.
> Numbers on stage must come from `landing-facts.md`. Anything marked [fill] comes from `validation.md`.
> Updated 2026-11-13 (after submission): the demo uses the public site's guided demo (12 steps, resettable), then the
> real devnet proof (`docs/demo-screenshots`) and a 20-second "Talk with Dad" clip. Backup: `Heirloom-pitch-5min.mp4`.

## 1. Script (timed)

| Time | Section | What's on screen |
|---|---|---|
| 0:00–0:18 | **Hook** | Slide 1 |
| 0:18–0:55 | **Problem** | Slide 1 |
| 0:55–1:15 | **What Heirloom is** | Slide 1 → switch to the app |
| 1:15–3:30 | **Live demo** | The app (phone or 390 px browser frame) |
| 3:30–4:25 | **Market, model, go-to-market** | Slide 2 |
| 4:25–5:00 | **Why us, what's next, the ask** | Slide 3 |

### 0:00–0:18 Hook (under 20 s)
> "Imagine a second-year student whose father dies. Her fees for next year are sitting in her dad's bank
> account. The account freezes while the estate is wound up, which can take two years. *(pause)* The money
> exists. It just can't reach the university. We built Heirloom so that never happens."

*(If a validation interviewee told you a real story like this and agreed to be quoted, swap it in:
"Last night we spoke to Lerato…". Never present an invented story as a true one.)*

### 0:18–0:55 Problem
> "In South Africa, two out of three adults have no will. When a parent dies, the estate freezes. A
> simple estate used to take six to nine months; it now takes about double, and three years isn't
> unusual. Unlocking it can cost up to 3.5% plus VAT. Meanwhile 2.8 million South African children have
> lost a parent, and university fees don't wait.
> And even when the money comes, it comes as a lump sum: relatives 'borrow' it, the car gets sold cheaply
> to a cousin's friend, and the fees don't get paid.
> Ask anyone in this room who has lost a parent how long it took before the money reached them."

*(Only if you run interviews before Saturday (`validation.md`), replace the last line with the real result: "This
week we asked N parents and young adults; X of them…". No interviews were run by 13 Nov, so never quote a number.)*

### 0:55–1:15 What Heirloom is
> "Heirloom is a **living** estate plan. A parent writes their wishes with an AI agent. The money sits in
> USD₮ in a vault that a Solana program controls, and every person, including the agent, has a self-custodial
> Tether WDK wallet. The plan starts working **today**: the monthly book allowance, the school fees. And when
> the parent dies, the same plan just keeps running, paid straight to the school, within the limits the parent set.
> Let me show you."

### 1:15–3:30 Live demo (cut to the app; show, don't tell)
**Before you go on stage:** open https://heirloom-one-iota.vercel.app → Try the demo → Start as Thabo, then
**Demo mode → Start from the beginning** so the story is fresh. Second tab: the README's "with proof" section.
Third: `Heirloom-pitch-5min.mp4` paused at **3:27** (Dad's call). Follow the black **Demo guide** bar at the top
("Take me there", "Switch to …"). **Say less, click more.** One sentence per step (all checked on 13 Nov):

1. **(15 s) Plan builder.** Tap the suggested replies, then **Sign and lock**. "The agent turns plain words into
   strict rules. Each one starts **now** or **after I'm gone**."
2. **(15 s) Fund the vault: the one payment flow.** 20,000 USD₮. Stop on the review: "Recipient, amount in USD₮ and
   rand, network, fee, verified USD₮. Approve. WDK signs. Pending… confirmed." *(Demo mode says "Simulated network".)*
3. **(5 s) Living plan.** **Pay now** on the book allowance: "He's alive; the plan already pays the bookstore."
4. **(20 s) The passing.** Switch to Lerato → upload the **Sample certificate** → "Looks genuine, 94%". Switch to Adv.
   Ndlovu, then Ms. Pillay: **Confirm the passing**. **Demo mode → Skip the waiting period** → **Unlock the estate**.
   "One document unlocks nothing: two trusted people, then a waiting period Thabo could still cancel."
5. **(20 s) The contract says no.** As Lerato, claim **5,000** → **Blocked by the contract: ExceedsPerClaimCap**.
   "The AI didn't stop that. The contract did." Change it to 3,500 → Ndlovu **Approve and pay** → "Paid to UCT, not to her."
6. **(15 s) Car sale.** Ndlovu lists it → Pieter offers 11,500 into escrow → **Ask the agent to settle** → Sold.
   "Money and title swap in one transaction; under the minimum can never win."
7. **(20 s) "And it's real."** Second tab, README "with proof": "We ran the whole story on Solana devnet. Here a fee
   statement hides an instruction telling the AI to pay out 50,000. Caught, 99 percent. Here's the real payment to
   the university on Explorer, and the fee was paid by Heirloom, so families never need SOL."
8. **(20 s) Talk with Dad.** Play the video from 3:27 for 20 seconds ("…I couldn't be there to drive you, but I made
   sure of this… I am so proud of you, my girl"). "An AI voice made with his consent, speaking only his words, and
   it can never move a cent."

*If you're running late, skip step 3 and shorten step 6 to "the agent settles the sale above the floor".*

**If the live demo breaks:** switch to `Heirloom-pitch-5min.mp4` at the same moment and keep talking. Don't debug
on stage. The public site needs no wallet or devnet, so a slow network is the only risk; use a phone hotspot as backup.

### 3:30–4:25 Market, model, go-to-market (Slide 2)
> "About 170,000 estates go to the Master every year. 7.8 million South Africans already hold crypto on
> local exchanges, and stablecoin trading went from under R4 billion to almost R80 billion in three years.
> 310 crypto providers are now FSCA-licensed, so rand settlement over PayShap and EFT is a partner away.
> Because the plan runs while you're alive, families use Heirloom **every month**, not once at death. That's why
> R99 a month makes sense: allowances, fees and family transfers today, the same plan protecting them tomorrow.
> Plus 1% of each payout, compared with 3.5% plus VAT for an executor.
> Our main channels will be partners we will approach: an exchange like Luno, whose users already hold USD₮;
> executors, who become verifier number one; burial societies and stokvels; and diaspora parents, who already
> send dollars home every term."

### 4:25–5:00 Close (Slide 3)
> "What's real today: the Solana program on devnet with 27 instructions and 25 tests, the whole family story run
> on-chain with an Explorer receipt for every step, Tether WDK wallets for every role including the agent, network
> fees paid by Heirloom, an AI agent that caught a prompt-injection attack, and 253 tests in the app. What's next: rand payouts through a licensed partner, a legal opinion on the trust structure,
> and a pilot with 20 families and one university. We're looking for introductions to an off-ramp partner and a
> university finance office.
> Heirloom: your wishes, enforced. Your children, provided for. Thank you."

## 2. Slides (maximum 3; maximum 4 bullets each)

**Slide 1: The money exists. It can't reach the school.**
- 2 in 3 South Africans have no will
- Estates take 1–3 years; executors charge up to 3.5% + VAT
- 2.8 million SA children have lost a parent
- Heirloom: a living plan in USD₮, paid straight to the institution, now and after

**Slide 2: Market and model**
- ~170,000 estates a year · 7.8m SA crypto users · R80bn stablecoin trading
- R99/month (used monthly: allowances, fees, family sends) + 1% per payout (vs. 3.5% + VAT)
- Channels we will approach: exchanges (Luno), executors, burial societies and stokvels, diaspora parents
- Rand settlement via FSCA-licensed off-ramps over PayShap/EFT (next step)

**Slide 3: Real today, next tomorrow**
- Real on devnet: the whole story on-chain (27 instructions, 25 + 253 tests), a receipt for every step
- Tether WDK wallets for every role, agent included; Heirloom pays the network fees
- The AI recommends, the contract decides: a hidden 50,000 USD₮ instruction caught, caps enforced on-chain
- Next: licensed rand off-ramp, legal opinion, pilot with 20 families + 1 university (our ask)

*(Put the source line in small text at the bottom of slides 1 and 2: Sanlam Legacy 2025, Moneyweb/Citizen
2024, SA Child Gauge 2024, SARB FSR Nov 2025, FSCA Apr 2026.)*

## 3. Q&A prep (17 likely questions)

Answer in **under 20 seconds**, then stop. If you don't know, say so and say how you'd find out.

1. **"Is this legally valid? SA requires a paper will."**
   "Correct, and we don't replace it. The paper will stays the legal document; it names the executor and
   refers to the Heirloom estate. The executor is verifier number one. For real money we'll structure the
   vault as an inter vivos trust with a licensed trustee, and we'll get a legal opinion first."

2. **"What stops someone uploading a fake death certificate?"**
   "Four layers: the AI flags anomalies; two of three verifiers the parent chose, including the executor,
   must attest; then a waiting period runs during which the owner can veto with one click. A forged PDF alone
   moves nothing. Later we add a Home Affairs status check through a licensed ID bureau."

3. **"Why would anyone pay monthly for something that happens once, at death?"**
   "Because it doesn't only happen at death. The plan runs now: the book allowance, the school fees, money to
   family, all through the same rules. The parent sees it working every month, and that's what they pay for.
   When they die, nothing has to be set up; it just continues."

4. **"How does this fit the Mobile Money and P2P track?"**
   "Every USD₮ movement, from a family send to a tuition payout, follows the flow Tether described: check the
   address, network and token; balance and fee quote; review; approve; WDK signs; pending until confirmed. If the
   connection drops we re-check the same signed transaction, so nobody pays twice. And Send to family is a plain
   P2P USD₮ wallet, including for diaspora parents sending home."

5. **"Why crypto at all? Why not a bank trust?"**
   "A bank trust is slow and expensive to set up for a R300,000 education fund. Rules in a program execute the
   same way every time and the family can audit them. And a parent in Dubai can fund it in dollars in minutes.
   The family never needs to understand crypto: they see rand."

6. **"Why USD₮ specifically?"**
   "It's the most used dollar stablecoin, it's native on Solana with cheap fees, and South Africans already
   trade stablecoins (almost R80bn in the year to October 2025, per the SARB). A 10-year education plan in
   dollars also protects against rand depreciation. Each estate pins its USD₮ mint; anything else is rejected."

7. **"Universities don't accept USDT."**
   "Right, and they won't need to. In the demo we pay a verified institution wallet, and the rand settlement is
   labelled simulated. In production the vault pays a licensed off-ramp such as Luno Settlements or Stables, which
   pays the university in rand over PayShap or EFT with the student number as the reference."

8. **"What about regulation: FSCA, FICA, SARS?"**
   "Crypto assets are financial products, and 310 providers are FSCA-licensed. Heirloom is self-custodial
   software; buying, selling and rand payouts go through licensed CASPs that do FICA. SARS sees those flows under
   CARF from March 2026, and we give the executor a full export. We'll confirm with counsel whether we need our
   own licence."

9. **"How do you make money?"**
   "R99 a month while the plan is running, 1% of each payout capped per year, and 1.5% on asset sales. About
   R8,000 over a typical family's lifetime, against up to R12,000 of executor fees on the same R300k.
   B2B2C: R15–R25 per member a month as an add-on through burial societies, insurers and exchanges."

10. **"Why Tether WDK and not Phantom?"**
    "WDK gives us self-custodial wallets inside our own app for every role: parents, children, verifiers, buyers
    and the AI agent. Nobody installs a browser extension, and it works as an installable phone app. WDK also
    gives us balances and fee quotes before every send. Heirloom never holds anyone's keys. And Heirloom's own WDK
    wallet pays the network fee, so a family never needs to hold SOL; it only co-signs an allow-list of instructions."

11. **"What if the AI is wrong or gets tricked?"**
    "The AI only recommends. Caps, floors and quorums are in the Solana program, so even a fully compromised
    agent can't pay more than the cap, pay a non-approved payee, or sell below the floor. Its wallet can only sign
    six instruction types. We tried to trick it: a fee statement with hidden text ordering it to approve 50,000 USD₮
    to another wallet. It caught that with 99% confidence, and even if it hadn't, a trusted person and the cap still
    stand in the way."

12. **"What happens if the signal drops in the middle of a payment?"**
    "We sign first, save the signature on the phone, then send. When the app comes back it asks Solana about that
    exact signature. If it landed: confirmed. If it didn't and it can still land, we re-send the same bytes, which
    can't pay twice. If it expired, we say 'nothing was paid, safe to try again'."

13. **"Privacy and POPIA? Death certificates on a blockchain?"**
    "Never. Documents stay off-chain in private storage; only a SHA-256 hash goes on-chain, so we can prove a
    document wasn't changed without revealing it."

14. **"Does this scale beyond South Africa?" / "Who's the competition?"**
    "Sub-Saharan Africa received $205bn on-chain in a year, and Nigeria and Kenya lead in stablecoin use. The
    rules engine is country-neutral; only the off-ramp and legal templates change. Competitors are either
    traditional (Capital Legacy, Sanlam Trust, banks: slow, lump sums, no crypto) or crypto dead-man's switches
    (Casa, SolWill: they hand the heir everything). Nobody pays the purpose, with a human quorum, for African
    families, while the parent is alive and after."

15. **"What's real and what's simulated?"**
    "Real: the Anchor program on devnet, the WDK wallets and their USD₮ transfers, the payment flow, the AI agent
    and the voice call, and the cap, floor and quorum checks, which are tested. Simulated: devnet uses our own
    6-decimal test USD₮ mint, the institutions are demo wallets, the waiting period and payment interval are 60
    seconds, documents are samples, and the rand settlement is labelled simulated. The contract isn't audited.
    The public site runs in demo mode (marked "Simulated network"); the same story ran on devnet from a laptop, and
    every step's Explorer receipt is in the README."

16. **"An AI copy of a dead parent's voice: isn't that creepy, or a deepfake risk?"**
    "Three rules. Consent: the parent records the consent line in their own voice while alive. Honesty: every call
    opens with 'This is Heirloom, speaking in your dad's voice', and it says it's an AI if asked. Grounded: it only
    speaks the words and values the parent wrote, it can never move money, and if a child mentions self-harm it
    steps out of the voice and gives helpline numbers. The child chooses to switch it on and can switch it off."

17. **"Why devnet and not mainnet?"**
    "Because the contract isn't audited yet, and we won't put families' money in an unaudited contract. The steps
    to mainnet are an audit, a licensed off-ramp and a legal opinion on the trust structure."

**Back-pocket answers:** *"Why would a family trust you?"*: "They don't have to trust us: the money is in a program
they can audit, and their own chosen people hold the keys to unlock it." *"What if the parent loses their phone?"*:
"Recovery through the verifier quorum is on the roadmap; for now the seed is backed up like any WDK wallet."
*"Who built it?"*: "Everything in the repo was written during the hackathon; the README lists the open-source
libraries."
