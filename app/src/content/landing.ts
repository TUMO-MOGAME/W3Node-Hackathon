/** Landing page copy. */
export const landing = {
  hero: {
    eyebrow: "A living family plan for South African families",
    title: "Plan for your family, now and after you're gone.",
    body: "Tell Heirloom what your family needs, in your own words. It becomes a plan on a secure vault of USD₮: a monthly book allowance and term fees paid on schedule today, and the same rules carrying on after you're gone. Money only ever moves for its purpose, straight to the university or the residence.",
    primary: "Try the demo",
    secondary: "See how it works",
    note: "No app store. No browser extension. Works on any phone.",
    card: {
      title: "Mokoena family estate",
      status: "Active",
      vaultLabel: "Secure vault",
      vault: "24 000.00 USD₮",
      vaultZar: "about R 428 400",
      rows: [
        { label: "Lerato · book allowance", detail: "Every month to Van Schaik Bookstore", amount: "85 USD₮", state: "Now" },
        { label: "Lerato · tuition", detail: "Paid to University of Cape Town", amount: "3 200 USD₮", state: "Paid" },
        { label: "Family car", detail: "Sold above Dad's floor, after he's gone", amount: "9 000 USD₮", state: "Later" },
      ],
      foot: "Every payment has a public receipt.",
    },
  },
  problem: {
    eyebrow: "The problem",
    title: "Good intentions get lost. And an estate can take a year to wind up.",
    body: "Money set aside for school has a way of going elsewhere, and children can't prove what was promised. Then, when a parent dies in South Africa, bank accounts freeze while the estate is reported, an executor is appointed and creditors are paid. Families often wait twelve months or longer. In that gap, registration is blocked, rent falls behind and the family car is sold in a hurry for far less than it is worth.",
    stats: [
      { value: "12+ months", label: "is a common wait before heirs see any money from a deceased estate" },
      { value: "Day one", label: "is when universities expect registration fees, whatever the estate is doing" },
      { value: "R 0", label: "reaches a child's pocket with Heirloom. Fees go to the institution, by design" },
    ],
  },
  how: {
    eyebrow: "How it works",
    title: "Three steps. Plain language throughout.",
    steps: [
      {
        title: "Say what your family needs",
        body: "Chat or talk with the Heirloom agent. \"R1 500 a month for Lerato's books. UCT fees every term. Sell my Corolla for no less than R160 000 when I'm gone.\" It writes the plan back in plain language and you choose which rules start now.",
      },
      {
        title: "Sign and fund the vault",
        body: "Create a self-custodial wallet in the app with Tether WDK, sign your plan and deposit USD₮. Rules you marked \"now\" start paying approved institutions on schedule. The rest wait. You can withdraw at any time.",
      },
      {
        title: "The plan outlives you",
        body: "After two of your three trusted people confirm your passing and a waiting period ends, the same plan carries on. The contract keeps paying the university directly and sells the car at or above your floor.",
      },
    ],
  },
  safety: {
    eyebrow: "Trust and safety",
    title: "The agent advises. The contract enforces. People you trust decide.",
    items: [
      { title: "Limits no one can talk their way past", body: "Caps, approved institutions and the car's minimum price live in a Solana program. Not even the AI agent can move money outside them." },
      { title: "Two of three trusted people", body: "Your executor, a lawyer, a family elder. A passing is only accepted when two of them confirm it, and unusual requests need them too." },
      { title: "\"I'm still here\"", body: "A waiting period follows every report of a passing. One tap from you cancels it and locks the vault again." },
      { title: "Hardship, handled with care", body: "If a child is in real need, a sworn affidavit commissioned at a SAPS station and two trusted people can allow the car to sell below your price, but never below your hardship floor." },
      { title: "Private papers stay private", body: "Death certificates, IDs and fee statements never go on a public ledger. Only a fingerprint of each document does, so anyone can check nothing was altered." },
      { title: "Your keys, on your phone", body: "Wallets are created with Tether WDK and the recovery phrase stays on your device. Heirloom's servers never hold your keys." },
    ],
  },
  proof: {
    eyebrow: "Proof, one tap away",
    title: "Built with Tether USD₮ and WDK on Solana",
    body: "Heirloom keeps the technology out of your way and the evidence within reach. Every deposit, approval and payment has a public receipt you can open on Solana Explorer.",
    points: [
      { term: "USD₮", detail: "The only money the vault accepts. The contract rejects look-alike tokens." },
      { term: "Tether WDK", detail: "Every wallet in the app, including the agent's own, is created and signed with the Wallet Development Kit." },
      { term: "Solana", detail: "Low fees make small, purpose-by-purpose payouts practical." },
      { term: "ZAR settlement", detail: "Amounts are shown in rand at a live South African exchange rate. Bank payout to institutions is simulated in this prototype." },
    ],
    honest: "Honest limits: this is a hackathon prototype on a test network. It sits beside a signed, witnessed will under the Wills Act and does not replace one. The car's digital title gates the handover; eNaTIS registration remains the legal record.",
  },
  cta: {
    title: "See a whole family story in three minutes.",
    body: "Step into the demo as Thabo, a father of three from Soweto. Build his family plan, watch the first payment go out, then switch to his children, his trusted people and a car buyer to see the rules hold after he's gone.",
    primary: "Try the demo",
    secondary: "Create my own wallet",
  },
} as const;

export type LandingCopy = typeof landing;
