# Heirloom: business case

> Owner: business/market lead. Written 2026-11-11 for the W3Node Node Engine Hackathon (Tether track).
> Every number has a source link. Items marked **[assumption]** are our own estimates, and items marked
> **[unverified]** could not be confirmed from a primary source. Don't present either as fact on stage.

## 1. The problem, in numbers

When a South African parent dies, the family loses the income first and the savings second, because the
savings are frozen until the estate is wound up.

| Fact | Number | Source |
|---|---|---|
| Adults without a will | **66%** of South Africans (Sanlam Legacy Wills Survey, Sept 2025) | [TimesLIVE, 19 Sep 2025](https://www.timeslive.co.za/news/south-africa/2025-09-19-66-of-south-africans-risk-family-feuds-by-dying-without-wills-sanlam-survey/) |
| People who die without a valid will | **70–75%**, attributed to the Master of the High Court | [Discovery (2021)](https://www.discovery.co.za/corporate/the-importance-of-a-last-will-and-testament) (older and secondary, so say "around 7 in 10") |
| Deaths a year | **474,366** registered deaths in 2024 (Stats SA) | [TimesLIVE, 29 Sep 2026](https://www.timeslive.co.za/news/south-africa/2026-09-29-tuberculosis-leads-male-deaths-diabetes-tops-among-women/) |
| Deceased estates a year | **About 170,000** reported to the Master each year | [The Citizen via Magzter (2024)](https://www.magzter.com/en/stories/newspaper/The-Citizen/MASTERS-OFFICE-CLEANUP-SLOW) **[secondary; no DOJ figure found]** |
| How long an estate takes | A simple estate used to take 6–9 months and now takes **about double**; Home Affairs and SARS can each take up to 6 months | [Moneyweb/The Citizen, 2 Dec 2024](https://www.citizen.co.za/business/winding-up-of-estates-in-sa-in-shambles) |
| Realistic range | "Eight months is quick, and **three years is not unusual**"; letters of executorship "alone can take weeks" | [Daily Maverick, 28 Oct 2025](https://www.dailymaverick.co.za/article/2025-10-28-frozen-estates-plan-for-the-everyday-while-it-your-affairs-are-wound-up) |
| Cost of winding up | Executor fee up to **3.5% of the gross estate + VAT** (≈4.0%), plus 6% of income after death | [Capital Legacy](https://www.capitallegacy.co.za/article/81/executor-fees-and-duties-explained), [legalwills.co.za (Jan 2026)](https://www.legalwills.co.za/blog/2026/01/15/executor-fees/) |
| Children who have lost a parent | **2.8 million** orphaned children in 2022 (14% of all children); **64%** of them lost their father | [Cape Times on the SA Child Gauge 2024 (UCT), 22 Aug 2024](https://capetimes.co.za/news/2024-08-22-mens-high-mortality-rate-leaves-many-children-orphaned) |
| University funding gap | NSFAS bursaries stop at a household income of R350,000; the "missing middle" (R350k–R600k) can only get loans. Just **12,000** loan applications for 2026 against **893,847** bursary applications; government had estimated 68,446 students in this group | [Business Day, 6 Jan 2026](https://www.businessday.co.za/news/education/2026-01-06-government-receives-lacklustre-response-to-offer-of-student-loans-to-the-missing-middle/) |
| Fee debt locks students out | Stellenbosch withheld **1,429 degrees** over student debt | [TimesLIVE, 30 Apr 2026](https://www.timeslive.co.za/news/south-africa/2026-04-30-stellenbosch-university-withholds-1429-degrees-as-student-debt-surpasses-r11bn/) |

**The problem in one sentence:** a parent who did save for their children's education can't guarantee
that the money reaches the university in time, or at all. The estate freezes for months to years, it
costs up to 4% to unlock, and once it is paid out as a lump sum nothing stops it being spent on something
else.

**What families live on meanwhile:** funeral cover (paid within days), the Master's living-expenses letter
(the bank releases some money from a frozen account, on request, per [GoLegal](https://www.golegal.co.za/frozen-assets-death/)),
relatives and stokvels. School and university fees for the coming term are often what gets cut.
**[This is our hypothesis. `validation.md` exists to test it before Friday.]**

## 2. Who suffers, and our target users

| Role | Who they are | What they need | What they do in Heirloom |
|---|---|---|---|
| **Buyer: the planning parent** (primary) | 35–55, salaried or self-employed, children aged 10–22, a household income of roughly R250k–R1m a year, so close to or inside the NSFAS "missing middle"; already pays for funeral cover; often already holds crypto (Luno alone has 6.3m SA users, [Launch Base Africa, Oct 2025](https://launchbaseafrica.com/2025/10/20/bitcoin-nvidia-and-staking-what-lunos-6-3m-south-african-users-are-actually-buying/)) | "If I die, my kids still finish school, and nobody wastes or grabs the money" | Writes the will with the agent, funds the vault in USD₮, registers the car, names 3 verifiers |
| **Buyer: the diaspora parent** | A South African or other African parent working abroad (UK, Gulf, Australia) who already pays for school and university at home, often in USD | Pay fees at home even if something happens to them; avoid rand volatility | Funds in USD₮ from abroad; payouts go to the institution, converted to rand at the time of payment |
| **Beneficiary** | A child or young adult (16–25), or the surviving guardian | Fees paid on time, without begging relatives or waiting for the estate | Uploads the fee statement or lease; follows a status timeline |
| **Verifier / executor** | The executor named in the paper will (often a family attorney or fiduciary firm), a trusted relative, a pastor or a friend | Clear evidence, little admin, no liability for releasing money too early | Attests the death, approves claims, approves hardship requests |
| **Institution** | University or school finance office, residence, landlord | Paid in rand, with a reference they can reconcile | Receives a rand payment (next step) or a USD₮ payment to a verified wallet (demo) |

**Persona 1: Thandi, 42, nurse in Gqeberha.** Single mother of two (16 and 19). Funeral cover with her
burial society, a small Luno account. Her fear: her brother "looking after" the money. What she wants:
the money can only go to the university.

**Persona 2: Sipho, 47, engineer in Dubai.** His daughter studies at Wits and his son is in Grade 10 in
Pretoria. He already sends USD every term. What he wants: "if I die tomorrow, the next 4 years are
already paid, in dollars, and nobody can touch it except for school".

**Persona 3: Lerato, 23, lost her father in her second year.** The estate took 2 years; she paused her
studies. She is our validation interviewee type and the story we tell on stage. **[Representative story.
Replace it with a real interviewee's words, with their consent, once validation is done.]**

## 3. Why now

1. **Stablecoins are already mainstream in SA.** Stablecoin trading on local exchanges grew from under
   R4bn in 2022 to almost **R80bn** in the year to October 2025, and dollar stablecoins replaced Bitcoin as
   the main trading pair (SARB Financial Stability Review, Nov 2025, via
   [FXStreet](https://www.fxstreet.com/cryptocurrencies/news/south-african-reserve-bank-flags-crypto-risks-as-users-reach-78-million-202511261025)
   and [Moonstone](https://www.moonstone.co.za/sarb-adds-crypto-and-stablecoins-to-new-financial-stability-risk-category/)).
   Luno, VALR and Ovex serve **7.8 million** users (July 2025, same source).
2. **Crypto is regulated now.** The FSCA had approved **310** crypto-asset service providers out of 533
   applications by 31 March 2026 ([FAnews, 15 Apr 2026](https://www.fanews.co.za/article/compliance-regulatory/2/financial-sector-conduct-authority-fsca-was-fsb/1059/update-on-licensing-and-supervision-of-crypto-asset-service-providers/43764)),
   and SARS applies the OECD CARF from **1 March 2026** ([SARS](https://www.sars.gov.za/latest-news/the-carf-takes-effect-bringing-transparency-to-crypto-asset-reporting/)).
   Licensed partners exist to settle in rand.
3. **Real-time rand rails exist.** PayShap has processed **461 million** transactions worth about
   **R403bn** since launch ([TechCentral](https://techcentral.co.za/high-fees-keep-payshap-stuck-in-first-gear/275073/)),
   so a rand payout to a university or landlord can settle in seconds.
4. **Africa is a crypto growth region.** Sub-Saharan Africa received over **$205bn** on-chain from July
   2024 to June 2025, up about 52%, and South Africa is the region's second-largest market after Nigeria
   ([Chainalysis, 10 Sep 2025](https://www.chainalysis.com/blog/subsaharan-africa-crypto-adoption-2025/)).
5. **The state system is slow and is digitising slowly.** The Master's online registration only went live
   on 10 Oct 2023 and covers new estates only ([DOJ](https://justice.gov.za/master/deceased.html)).

## 4. Solution–market fit

| Pain | What Heirloom does | Why it fits SA |
|---|---|---|
| The estate freezes for 1–3 years | Purpose money sits in a program-controlled USD₮ vault that unlocks on proof of death plus a quorum, in days rather than years | Families can pay the next term's fees without waiting for the L&D account |
| A lump sum gets spent or "borrowed" by relatives | Money pays only an approved institution, within per-claim and lifetime caps, until a set end date | Protects the child and the surviving parent from family pressure |
| A fake death certificate or claim | AI check + 2-of-3 verifiers (including the executor) + a waiting period + the owner's veto | No public Home Affairs death API exists; the deceased flag lags by 3–5 weeks ([WinDeed](https://www.windeed.co.za/?p=5015)) |
| The car is sold cheaply to a "friend of the family" | The estate sells the car's digital title only at or above the owner's floor price; going lower needs a SAPS-commissioned hardship affidavit plus 2 verifiers, and never below a hardship floor | Cars are often a family's second-biggest asset, and the executor must handle the eNaTIS transfer |
| The rand loses value over a 10-year plan | The vault holds USD₮; amounts are shown in rand at a live SA exchange rate | Diaspora parents already think in USD |
| The will is paper, but the wishes are complicated | An AI agent turns plain-language wishes into strict rules; the paper will names the executor and points to the Heirloom estate | Respects the Wills Act (a signed paper will is still needed) |

**What Heirloom is not:** it doesn't replace a will, an executor or the Master. It is a programmable
**estate-instruction and trust-administration layer** that sits next to them.

## 5. Competitors and differentiation

| Player | What they offer | Price | Gap Heirloom fills |
|---|---|---|---|
| Capital Legacy | Free wills; executor service on a sliding scale below 3.5%; Legacy Protection Plan insures executor, conveyancing and trust costs | Free will; fees recovered at death ([Capital Legacy](https://www.capitallegacy.co.za/capital-legacys-response-to-article)) | Still a slow paper estate; no purpose-locked payouts; no crypto |
| Sanlam Trust / Sanlam Legacy Plan | Free will if appointed executor; testamentary trusts; an insured plan administered by Capital Legacy | Trust fees negotiated; **no published %** ([Sanlam](https://www.sanlamonline.co.za/financialplanning/wills-trusts-estates/sanlam-legacy-plan)) **[unverified]** | Trusts are expensive to set up and run, and slow to pay; no crypto |
| Banks' will and estate services (Absa, FNB, Standard Bank, Nedbank) | Will drafting; the bank acts as executor | Usually the executor tariff, up to 3.5% + VAT **[typical, not each bank's quote]** | Same estate delays; the bank account itself is frozen |
| Funeral insurers and burial societies | Pay out within days for the funeral | R50–R500/month **[assumption]** | Cover the funeral, not the next 4 years of school |
| Crypto inheritance tools (Casa, Vault12, Kresus) | Key recovery or a dead man's switch that hands the heir the whole wallet | Casa $250/yr; Vault12 Inheritance $29.99/mo; Kresus $99.99/yr ([Casa](https://casa.io/gold), [Vault12](https://vault12.com/pricing/), [KuCoin news](https://www.kucoin.com/news/flash/kresus-launches-99-99-year-inheritance-service-for-self-custody-wallets)) | Lump sum to the heir; no purpose rules; no executor; US-focused |
| Solana dead-man's-switch projects (SolWill, LifeProof, Last Safe) | Inactivity → named wallets get everything | Free / hackathon | Same as above, plus no human quorum against fraud |

**Our edge, in four words: purpose, quorum, floor price, Africa.** Money goes to the purpose (paid to the
institution), a human quorum including the executor guards death and exceptions, assets sell at a floor
price, and it is built for South African rails (rand display, PayShap/EFT off-ramps, SAPS affidavits,
eNaTIS handover).

## 6. Business model (pricing in ZAR)

**Recommended model: a hybrid of a low subscription plus a small fee on what is paid out, sold mainly
through partners.**

| Stream | Price | Who pays | Notes |
|---|---|---|---|
| **Heirloom Family (B2C)** | **R99/month or R990/year** while the parent is alive. Writing the rules with the agent is free | Parent | Covers AI reviews, verifier tools, the vault and the dashboard |
| **Disbursement fee** | **1% of each payout**, capped at R2,500 per beneficiary per year | Taken from the vault at payout | Compare: executor tariff 3.5% + VAT on the gross estate |
| **Asset sale fee** | **1.5% of the car's sale price** (min R1,500) | From the sale proceeds | Below typical dealer trade-in discounts **[assumption]** |
| **B2B2C white-label** | **R15–R25 per member per month** as an add-on to a funeral policy or burial society plan ("education continuation cover"), or R5–R10 per policy as a rider for existing insurers | Funeral insurer, burial society, bank, fiduciary | The partner owns the customer and the KYC; Heirloom runs the vault and the rules |
| **Executor / fiduciary seat licence** | R500/month per firm + R50 per estate per month | Attorney or fiduciary firm | Their inbox for verifying deaths and approving claims across all their clients |

**Simple unit economics, B2C [assumptions, check after validation]:**
- A typical family vault: **R300,000** (about 4 years of university fees plus residence), paid out over 4 years.
- Revenue per family: subscription R990/yr × 5 years before death on average **[assumption]** = R4,950;
  disbursement fees ≈ R3,000 (1% of R300k; under the cap) → **≈ R7,950 lifetime**.
- What the family saves: the executor tariff on R300k would be up to R10,500 + VAT = **R12,075**, and
  the money can arrive a year or more earlier. (If the vault sits in a trust structure, those assets
  generally fall outside the deceased estate. **Needs a legal opinion; see §9.**)
- Cost to serve per family per year **[assumption]**: AI reviews R50–R150 (about 10–20 document reviews),
  Solana fees under R5, KYC/ID check R20–R40 once, off-ramp spread 0.5–1.5% (passed through at cost),
  support R100. **Gross margin ≈ 75–80%** on the subscription.
- Customer acquisition cost through partners **[assumption]**: R150–R300 per family (partner revenue share
  of 20–30% instead of paid ads). Payback in under 4 months.

**B2B2C at scale [illustration, not a forecast]:** about 17 million funeral policies were in force in
mid-2025 ([Moonstone on ASISA data](https://www.moonstone.co.za/slight-increase-in-life-insurance-policies-in-first-half-of-2025/)).
If 0.5% of them (85,000) added an R20/month education rider, that is **R20.4m a year** in revenue before
disbursement fees.

## 7. Go-to-market: the first 1,000 families

| Step | Channel | Target | Why it works |
|---|---|---|---|
| 1. Months 0–3 | **Pilot with 20 families** from our own networks, WeThinkCode_/hackathon community, church and stokvel contacts | 20 vaults funded, 5 executors onboarded | Proves the flow end to end with real (small) USD₮ amounts |
| 2. Months 2–6 | **Crypto exchange partner (Luno or VALR)**: "Plan where your crypto goes" in-app | 500 families | 7.8m users already hold stablecoins; FSCA-licensed; Luno Settlements can pay rand out |
| 3. Months 3–9 | **Estate attorneys and fiduciaries** (start with 10 small firms; then Capital Legacy or Sanlam Trust) | 200 families via 10 firms | The executor is already verifier #1; firms get a faster, auditable process and a new fee line |
| 4. Months 6–12 | **Burial societies and stokvels** via NASASA, plus one funeral insurer pilot | 300 families + a white-label pilot | More than 11 million South Africans belong to stokvels ([EWN, NASASA](https://www.ewn.co.za/more-than-11-million-south-africans-are-members-of-stokvels-nasasa)); trust-based, group decisions already match our verifier quorum |
| Ongoing | **Diaspora**: SA expat communities in the UK, UAE and Australia; school and university alumni groups | Long tail | They already pay fees in USD |

**Top 3 partners to name in the pitch:** **Luno** (users + rand settlement), **NASASA** (stokvels and
burial societies), and **an executor/fiduciary firm such as Capital Legacy**. These are **targets, not
signed partners.** Say "we will approach", never "we partner with".

## 8. Local infrastructure integrations

| Integration | Status | How |
|---|---|---|
| **USD₮ → ZAR off-ramp** | Next step (P2) | Licensed CASPs with payout APIs: **Luno Settlements** (ZAR payouts to third parties, [Luno](https://www.luno.com.ng/settlements)), **Stables** (USDT→ZAR over **PayShap/EFT**, [Stables](https://stables.money/transfers/south-africa)), VALR, Yellow Card. The vault pays the off-ramp, and the off-ramp pays the university in rand with the student number as the reference |
| **PayShap / EFT** | Via the off-ramp | Real-time rand to the institution; limit set by the payer's bank (up to R50,000 for many, [TechCentral](https://techcentral.co.za/payshap-is-getting-a-huge-upgrade/255847/)) |
| **Live ZAR exchange rate** | In the demo | Rand amounts shown from a live SA exchange price feed |
| **University and school fee systems** | Pilot | The fee statement (PDF) is read by the AI; the payment reference is the student number; later, direct integration with a student finance office |
| **Master of the High Court** | Process link | The executor named in the will is verifier #1; Heirloom exports an estate statement for the L&D account; the online estate-registration number is stored as a reference |
| **DHA / ID verification** | P2 | Deceased-status check through a licensed verification bureau (Home Affairs updates 3–5 weeks after the death, [WinDeed](https://www.windeed.co.za/?p=5015)) |
| **SAPS affidavits** | In the demo | Hardship affidavits are commissioned free at SAPS stations; the AI checks the jurat, commissioner details, stamp and date; people approve |
| **eNaTIS** | Handover pack | The NFT is a "digital title" only. After the sale the app generates the NCO notification data and the executor's tasks (letter of executorship needed, [gov.za](https://www.gov.za/services/services-residents/driving/register-motor-vehicle/register-vehicle-deceased-person-or)) |
| **Tether WDK** | In the demo | Self-custodial wallets for every role, including the agent; gasless module so families don't need SOL |

## 9. Regulation and compliance path

| Law / regulator | What it means for us | Our path |
|---|---|---|
| **Wills Act 7 of 1953** | A will must be signed and witnessed on paper; ECTA excludes wills from e-signatures ([CDH](https://www.cliffedekkerhofmeyr.com/en/news/publications/2025/Practice/Trusts-Estates-Law/trusts-and-estates-law-alert-20-March-valid-or-not-valid-unsigned-electronic-wills-in-south-africa)) | Heirloom never claims to be a will. We generate a clause for the paper will that names the executor and refers to the Heirloom estate |
| **Administration of Estates Act 66 of 1965** | Estates must be reported to the Master within 14 days ([DOJ](https://justice.gov.za/master/deceased.html)); the executor administers the estate's assets | The executor sits in the quorum; Heirloom provides an audit trail for the L&D account |
| **Trust Property Control Act 57 of 1988** | If the vault is structured as an inter vivos trust, trustees need letters of authority from the Master | Year 1: partner with a licensed fiduciary that acts as trustee, with Heirloom as the programmable administration tool. **Get a legal opinion before taking real money** |
| **FSCA: crypto assets are financial products (FAIS)** | Advice or intermediary services on crypto need a CASP licence; 310 approved by Mar 2026 ([FAnews](https://www.fanews.co.za/article/compliance-regulatory/2/financial-sector-conduct-authority-fsca-was-fsb/1059/update-on-licensing-and-supervision-of-crypto-asset-service-providers/43764)) | Self-custodial software (WDK) + a licensed partner for buying, selling and rand payouts. Decide with counsel whether we need our own CASP licence or work under a partner's |
| **FIC Act (FICA)** | KYC and AML for accountable institutions (CASPs are accountable institutions) | KYC is done by the exchange or off-ramp partner; Heirloom checks that payees are verified institutions |
| **POPIA** | Death certificates and IDs are personal information; a responsible party and an information officer are needed | Documents off-chain, encrypted (P2); only SHA-256 hashes on-chain; consent at onboarding; privacy policy |
| **SARS: CARF + estate duty + CGT** | CASPs report to SARS from 1 Mar 2026 ([SARS](https://www.sars.gov.za/latest-news/the-carf-takes-effect-bringing-transparency-to-crypto-asset-reporting/)); crypto is part of the estate for tax | Exportable records for the executor's tax returns; never market Heirloom as a way around tax |
| **Exchange control (SARB)** | Crypto is not yet fully covered; the 2026 Budget Review signalled amendments ([Moonstone](https://www.moonstone.co.za/?p=59342)) | Payouts settle in rand via licensed partners; diaspora inflows count as inward transfers. Monitor |

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A court or the Master treats the vault as estate property and freezes it | The executor is a verifier, so the legal process and the program agree; trust structure via a licensed trustee; legal opinion before launch |
| A fake death certificate | AI red flags + 2-of-3 human verifiers + waiting period + owner veto; ID-bureau check later |
| The AI is wrong or is manipulated (prompt injection) | The AI only recommends. Caps, floors and quorums are enforced by the Solana program; humans approve exceptions |
| Institutions won't accept USD₮ | Rand payouts through licensed off-ramps over PayShap/EFT; the institution never touches crypto |
| Regulation changes (stablecoins, exchange control) | Licensed partners carry the regulated activity; we keep the payout layer swappable |
| Trust: "crypto = scam" perception | Lead with the executor and the burial society, not with crypto; plain-language rules; public audit view |
| Low willingness to pay | Validate this week (see `validation.md`); B2B2C makes the partner pay, not the grieving family |
| Smart contract bug | Devnet only now; external audit before mainnet; small caps in the pilot |
| A lost seed phrase | WDK self-custody + a recovery design using the verifier quorum (P1) |

## 11. 12-month roadmap

| When | Milestone |
|---|---|
| Nov 2026 | Hackathon MVP on devnet: will writer, vault, death quorum, tuition payouts, car sale with floor and hardship. 10+ validation interviews |
| Dec 2026 – Feb 2027 | Legal opinion (trust structure, FSCA position); privacy policy and POPIA set-up; security review of the program; choose an off-ramp partner (Luno Settlements or Stables) |
| Mar – May 2027 | **Pilot: 20 families, 5 executors, 3 institutions**; rand payouts to universities via PayShap/EFT; university fee-statement templates |
| Jun – Aug 2027 | External audit; mainnet with real USD₮ and small caps; ID-bureau deceased check; executor/fiduciary dashboard |
| Sep 2027 (Wills Month) | Public launch; exchange in-app partnership; first burial-society white-label pilot |
| Oct – Nov 2027 | 1,000 families; first insurer rider; expansion study for Kenya and Nigeria (where Chainalysis shows the strongest stablecoin use) |

## 12. Pilot proposal (for a partner or a judge who asks "what next?")

- **Who:** 20 families (10 local, 10 diaspora), each with 3 verifiers including an executor, plus 3
  institutions (one university, one school, one residence/landlord) and one licensed off-ramp.
- **What:** each family funds a vault with R5,000–R20,000 in USD₮ and writes rules with the agent. We
  run **simulated deaths** (the owner signs a test "death" and vetoes after the payout test) to prove death
  → unlock → rand payout to the institution, end to end.
- **Success measures:** time from death claim to first payout under 7 days (vs. months); 0 payouts
  outside the rules; at least 8 of 10 families say they would pay R99/month; at least 3 executors want to
  continue; at least 1 partner LOI.
- **Cost:** about R60,000 **[assumption]**: legal opinion R25k, audit pre-review R15k, AI and
  infrastructure R5k, partner and travel R15k.
- **Ask:** an introduction to an exchange or off-ramp partner and to one university finance office.
