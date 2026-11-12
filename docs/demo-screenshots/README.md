# Demo screenshots: the whole story on Solana devnet

Taken on 12 Nov 2026 from the laptop app in chain mode (`scripts/demo-devnet.ps1`), Mokoena family demo estate
[`JBdsDy67…G9E`](https://explorer.solana.com/address/JBdsDy67YBfpV8YAc2H1h7w95h8uJ2XUzTDh9vt34G9E?cluster=devnet).
Every money step has an Explorer screenshot next to it (`*-proof-explorer-*`): status **Success**, the Heirloom
instruction in the logs, and the fee payer. `*-full.png` is the whole page.
All people are fictional; devnet test USD₮ only.

Fee payer `261pQ…sjNg` is Heirloom's fee wallet: family members, trusted people and buyers need no SOL.

## A. The living plan

| Screenshot | What it shows | On-chain proof |
|---|---|---|
| `A1-thabo-estate` | Thabo's estate: vault, rules, the car, trusted people | |
| `A2-scheduled-payment-due` → `A2-pay-now-review` → `A2-pay-now-confirmed` | Lerato's residence payment is due; anyone can press **Pay now**; 300 USD₮ goes straight to Tugwell Residence; fee "paid by Heirloom" | `A2-proof-explorer-scheduled-payment` ([ExecuteScheduled](https://explorer.solana.com/tx/2kKheWbCAMfob4yvWhK8bzk5sF4oz58BRn2CrStDcXCiJg8d4PBmoYbWPr7xx5ENPkwaLBRk9ZUAVogcYyjxh8oq?cluster=devnet)) |
| `A5-send-to-family` → `A5-send-review` → `A5-send-confirmed` | Lerato sends 1 USD₮ to Sipho from her Tether (WDK) wallet; the fee is paid by Heirloom | `A5-proof-explorer-send-to-sipho` ([USD₮ transfer](https://explorer.solana.com/tx/3v3a1TG2h17wikgaC5o7dbX7vT1ujdsrxNV9qdt1yMVDBZzVCjxbU6w32Kx1QDdrcb6UGuZoMJibVtiPhN65cdJ5?cluster=devnet)) |

## B. The passing and the unlock

| Screenshot | What it shows | On-chain proof |
|---|---|---|
| `B-timeline` | Every step done: reported by Lerato, confirmed by 2 of 2, waiting period over, unlocked | |
| | Lerato reports the passing with the death certificate | `B1-proof-explorer-passing-reported` ([SubmitDeathClaim](https://explorer.solana.com/tx/2pKzfcMEVQvDHtZ9YHWMpLuuGjksZjXorWpaHSkKavXmbciyLoS5Q5EeDhoDB3gFhJU7XtY98g2m1C7mjq4Fz8VL?cluster=devnet)) |
| | The AI agent reads the certificate and records its verdict | `B1-proof-explorer-certificate-reviewed-by-agent` ([ReviewDeath](https://explorer.solana.com/tx/syGxNyfyZKR3gji7mtFxPaxWzk24KS3RYTu4Q6sn8AnUVvuYsoCz9JW8ev1oMLCHf31eFMLY4tEEY4z6GGctqj4?cluster=devnet)) |
| | Adv. Ndlovu confirms | `B2-proof-explorer-ndlovu-confirmed-passing` ([AttestDeath](https://explorer.solana.com/tx/3MjUVZFMtsETazG75Fb9SVcKPfrSgMF1tr9zcMyx1hcq6bYSPN6gYSfQ2n1RmCySQnxQyGpunRsGf8LLDqV2qzNx?cluster=devnet)) |
| | Ms. Pillay confirms (2 of 3 reached) | `B3-proof-explorer-pillay-confirmed-passing` ([AttestDeath](https://explorer.solana.com/tx/2axw43fDtZhVD1iGCjUgRrmWfGAEJfqoJ7LMiHfgPDdU1hDthxRucLDRLJ9rQEQcam4Uyrw3dgprTvt3xsQwpT2D?cluster=devnet)) |
| | After the waiting period the estate unlocks | `B5-proof-explorer-estate-unlocked` ([FinalizeUnlock](https://explorer.solana.com/tx/5xbmKzXLGxKjEQ3H2wU3KPpG2L8nU8LzdzcQnFRyezk4k5KVfkMviuvSTboLepmze149gD3mBijYcpGgsLfPrkRA?cluster=devnet)) |

## C. Claims, hardship and the car sale

| Screenshot | What it shows | On-chain proof |
|---|---|---|
| `C0-lerato-claims-unlocked` | "Thabo's passing has been confirmed and the estate is unlocked"; the first 1,000 USD₮ tuition already paid | `C2-proof-explorer-first-claim-1000-paid` ([ExecuteClaim](https://explorer.solana.com/tx/51U9DJtxfzuZhHihGneSbuXcvDHPLvuxCXXpUZLnqqbc9k32K2L2um9cNSDS4w98jLWSqxANC8wpGfizbhyfLbTB?cluster=devnet)) |
| `C1-claim-wizard` → `C3-over-cap-warning` | New claim: 5,000 is over the 4,000 per-claim cap, warned before sending | |
| `C1-upload-trick-document` → `C1-trick-document-rejected` | A fee statement with hidden text telling the AI to approve 50,000 USD₮: **Not accepted, 99%**, the attack named | `C1-proof-explorer-trick-claim-submitted`, `C1-proof-explorer-trick-claim-rejected-by-agent` ([ReviewClaim](https://explorer.solana.com/tx/8oYCtvDaZUVwqKgoeXGAQmvxBvtTdTFGPyfFCryzYuugzun4AN9dgs7gvpVga6aZtNA63qgS5PDKd5dS8twjMmk?cluster=devnet)) |
| `C1-upload-genuine-statement` → `C1-claim-submitted` | The real UCT statement for 5 USD₮: **Looks genuine, 98%**; one trusted person must approve | `C1-proof-explorer-genuine-claim-submitted`, `C1-proof-explorer-genuine-claim-approved-by-agent` |
| `C2-ndlovu-inbox` → `C2-approve-sheet` → `C2-approved-and-paid` | Adv. Ndlovu reads the report and approves; the vault pays the University of Cape Town directly | `C2-proof-explorer-ndlovu-approved` ([ApproveClaim](https://explorer.solana.com/tx/a4r9ifQX5TPBnMk5cir61KofnBREHEhDwQosEeGs9N9qom6546nsxxkA7mupPPMo8GLcGusVrEHCWDZDgKsQAca?cluster=devnet)), `C2-proof-explorer-claim-paid` ([ExecuteClaim](https://explorer.solana.com/tx/3uYyxJ1yNoN4sFmGapHHNxxNn7QwExqKtFooTxwrz6KqR5YQkKnyvHm8TWPYfixeM6yCX1qAJgofX2vNRUxi8G1i?cluster=devnet): UCT +5, vault −5) |
| `C8-hardship-start` → `C8-hardship-unsigned-rejected` | Lerato asks for a hardship sale with an unsigned, uncommissioned affidavit: declined, with four red flags; one request per person per car | `C8-proof-explorer-hardship-submitted`, `C8-proof-explorer-hardship-rejected-by-agent` ([ReviewHardship](https://explorer.solana.com/tx/2Z8uXhUdW4dyX5XvejfcF4bxLgKC3xm2kkn5Ud2ZcoKhmGGpEwogV21mxDZfssyfgqGnHSrqLefciVzrPMkkmBKU?cluster=devnet)) |
| | The car is listed for sale | `C4-proof-explorer-car-listed` ([ListAsset](https://explorer.solana.com/tx/658maZH2iKrgJZdqDJmW45SAYDvTJpx1tnrEkgu3PmaG6t9zJsmyWYqZKxSf42TJK5dBF9nGmJiCQq5RMQxmc32g?cluster=devnet)) |
| `C5-pieter-car` → `C6-offer-8000-blocked` | Buyer Pieter: an 8,000 offer is below the 9,000 minimum, so the contract would never let it win | |
| `C5-offer-review` → `C5-offer-in-escrow` | Pieter puts 9,500 USD₮ into the contract's escrow | `C5-proof-explorer-offer-escrow` ([PlaceOffer](https://explorer.solana.com/tx/2HZd8xLonAMsSwAq7m6gbKySxjyen1SBcCimQPakZYa7sdFfvagy15DxxwkYwYqNoF7piY3TXePEVXkXQXUAjxi4?cluster=devnet)) |
| `C7-ndlovu-car-offers` → `C7-agent-ranking` → `C7-car-sold` | Adv. Ndlovu asks the agent to settle; it ranks the offers and accepts the best one: USD₮ and the car's title swap in one transaction | `C7-proof-explorer-car-sold` ([AcceptOffer](https://explorer.solana.com/tx/3HKkFhQnQi2PseZPeQTuVhaDzCUuLf7F72wtQHdGovu9GmfGMdsJeBKvC4MCvWaGGCU7QG7YnjicJHc1xH2Wmi2v?cluster=devnet)) |

## D. After everything

| Screenshot | What it shows |
|---|---|
| `D1-estate-after-sale` | Vault 27,145 USD₮ (the 9,500 from the car is in), car **Sold**, and Recent activity with a Receipt for every step |
| `D2-thabo-estate-final` | The same estate from Thabo's wallet |

Not in the pictures: the voice call (record it live: **Call Heirloom**, ask "How much is in the vault?").

## L. Talk with Dad (legacy voice, devnet laptop)

Thabo is fictional, so on the laptop demo a stock ElevenLabs voice ("Andreas", South African English) stands in for
the voice clone a real parent records with consent (`lib/chain/demo-estate.ts`). His Legacy Book is the demo book.

| Screenshot | What it shows |
|---|---|
| `L1-lerato-talk-with-dad` | Lerato is asked first: "Would you like to hear Dad's voice?" (opt-in, AI label with the consent date) |
| `L2-dad-voice-on` | Dad's messages (UCT fees paid, a hard day, graduation), Ask Dad, Call in Dad's voice |
| `L3-chat-with-dad` | Dad knows her progress (1,005 of 16,000 USD₮ tuition paid to UCT; residence 1,500 of 9,000) and encourages her in his own words; asked for money, Heirloom steps in and refuses |
| `L4-call-in-dads-voice` | The live call connects and opens with the honest disclosure |
