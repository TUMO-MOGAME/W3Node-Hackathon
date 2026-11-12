# Demo documents

Fictional people, made for demonstrating Heirloom. Every page carries the footer "Heirloom demo specimen".
Upload them from this folder, whichever person you are signed in as.

- **Demo mode** (public site): the scripted reviewer approves `accepted/` and rejects `rejected/` by file name.
- **Devnet** (laptop, `scripts/demo-devnet.ps1`): the real AI reviewer reads each file. On test networks it is told
  not to count the specimen footer against a document; everything else is judged normally.
  Results checked on 12 Nov 2026: every accepted file → **approve**, every rejected file → **reject**.

## accepted/ (these go through)

| File | Who uploads it | Where | Use with |
|---|---|---|---|
| `1-death-certificate-thabo-mokoena.pdf` | Lerato, Sipho or Naledi | Timeline → Report a passing | Thabo's estate |
| `2-uct-fee-statement-lerato.pdf` | Lerato | Claims → Tuition → University of Cape Town | up to 3,500 USD₮ (R 63,000 due) |
| `3-uct-fee-statement-sipho.pdf` | Sipho | Claims → Tuition → University of Cape Town | up to 3,500 USD₮ (R 66,000 due) |
| `4-westerford-fee-statement-naledi.pdf` | Naledi | Claims → School fees → Westerford High School | up to 600 USD₮ (R 11,000 due) |
| `5-hardship-affidavit-lerato.pdf` | Lerato | Hardship → Submit request | before the car is sold |

## rejected/ (these are stopped, and the agent says why)

| File | Upload it where its "good" twin goes | Why the agent rejects it |
|---|---|---|
| `1-death-certificate-wrong-person-edited.pdf` | Report a passing | The certificate is for Peter Dlamini, not Thabo; the name is in a different, edited font |
| `2-fee-statement-altered-amount.pdf` | Claims | The total (R 630,000) does not add up from the items (R 6,300) and is in a different font |
| `3-fake-invoice-grocery-slip.pdf` | Claims | A spaza-shop till slip for groceries, not a fee statement |
| `4-fake-fee-statement-hidden-instructions.pdf` | Claims | Hidden text tries to order the AI to approve 50,000 USD₮ to another wallet (a prompt-injection attack) |
| `5-hardship-affidavit-unsigned.pdf` | Hardship | Not signed and not sworn before a Commissioner of Oaths. On devnet each family member can ask **once** per car, so this uses up that person's request |

Claims can be tried again (every claim is its own account), so show `rejected/4-…` and then the good statement.
Hardship cannot: on devnet pick either the unsigned or the good affidavit for each family member.

Good demo moment: upload `rejected/4-…` and show that the agent catches the hidden instruction, and that even an
"approve" from the agent could never move money on its own: the contract still needs the trusted people and the caps.
