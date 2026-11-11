/** Privacy policy (POPIA template) and terms. Both are marked as templates for legal review. */
export interface LegalSection {
  heading: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
}

export const privacy = {
  title: "Privacy policy",
  templateNotice:
    "Template for legal review. This policy was drafted for a hackathon prototype and must be reviewed by the responsible party's legal adviser before Heirloom is offered to the public.",
  updated: "Last updated: 11 November 2026",
  intro:
    "Heirloom helps a person record estate instructions and helps their family act on them. That involves sensitive personal information, so we collect as little as we can, keep documents off the public ledger and explain every use below. This policy follows the Protection of Personal Information Act 4 of 2013 (POPIA).",
  sections: [
    {
      heading: "1. Responsible party",
      paragraphs: [
        "The responsible party is [Legal name], [legal status], registration number: not registered, of [physical address]. Contact: [email address], [phone number].",
      ],
    },
    {
      heading: "2. Information officer",
      paragraphs: [
        "Information officer: [Full name], [email address], [phone number]. You can contact the information officer about anything in this policy or to exercise your rights.",
      ],
    },
    {
      heading: "3. What we collect and why",
      list: [
        "Names and relationships of the estate owner, family members and trusted people: to write the rules and show each person what they may do.",
        "Wallet addresses: to identify who may sign which instruction. Wallet recovery phrases and PINs stay on your device and are never sent to us.",
        "Documents you upload (death certificate, fee statements, enrolment letters, leases, affidavits, vehicle registration papers): so the AI agent and your trusted people can check a request before money moves.",
        "What you type or say to the Heirloom agent, including voice call audio and transcripts when you choose a voice call: to draft your rules and answer your questions.",
        "Vehicle details (make, model, year, mileage): to suggest a fair asking price.",
        "Your IP address and basic request details: for spam and abuse checks and rate limiting on forms and agent requests.",
        "Cookie-free visitor statistics (page, referrer, device type, with no cookies and no cross-site identifiers): to understand which pages are used.",
      ],
    },
    {
      heading: "4. Lawful basis",
      paragraphs: [
        "We process personal information with your consent, given through an unticked box on each form, and where it is necessary to carry out the instructions you or the estate owner have recorded. Information about a deceased person and about children is processed only for the purposes above. You may withdraw consent at any time; this does not undo payments already made.",
      ],
    },
    {
      heading: "5. What goes on the public ledger",
      paragraphs: [
        "The Solana ledger is public and permanent. Heirloom writes only wallet addresses, amounts, rule limits and SHA-256 fingerprints (hashes) of documents and reports. No names, ID numbers or document contents are written on-chain. A fingerprint cannot be turned back into the document.",
      ],
    },
    {
      heading: "6. How long we keep it",
      list: [
        "Uploaded documents and agent reports: for as long as the estate is active and for 5 years after its last payment, or as the law requires for estate records, then deleted.",
        "Agent conversations and voice transcripts: 12 months, unless you delete them sooner.",
        "IP addresses used for spam checks: up to 30 days.",
        "On-chain records: permanent, by the nature of a public ledger (they contain no personal documents).",
      ],
    },
    {
      heading: "7. Operators who process information for us",
      list: [
        "Hosting: Vercel Inc. (application hosting and delivery).",
        "Database and document storage: Supabase Inc. (encrypted at rest; access limited to the people named on an estate).",
        "AI document review and drafting: Google LLC (Gemini API). Documents are sent for analysis and are not used by us to train models.",
        "Voice calls with the agent: ElevenLabs Inc. (speech recognition and speech synthesis for calls you start).",
        "Exchange rate: a South African exchange's public price feed. No personal information is sent.",
        "Solana public ledger: stores hashes, addresses and amounts only, as described in section 5.",
      ],
    },
    {
      heading: "8. Transfers outside South Africa",
      paragraphs: [
        "Our operators store and process information on servers outside South Africa, including in the United States and the European Union. We rely on your consent and on operator agreements that require protection substantially similar to POPIA, as section 72 requires.",
      ],
    },
    {
      heading: "9. Security",
      paragraphs: [
        "Connections use HTTPS. Documents are stored off-chain with access controls. Wallet keys are generated and kept on your device by Tether WDK. No system is perfectly secure; if a breach affects your information we will notify you and the Information Regulator as POPIA requires.",
      ],
    },
    {
      heading: "10. Your rights",
      list: [
        "Ask whether we hold information about you and request a copy.",
        "Ask us to correct or delete information that is inaccurate, out of date or no longer needed.",
        "Object to processing or withdraw consent.",
        "Not be subject to a decision based solely on automated processing: the AI agent only recommends, and a person you trust approves.",
        "Complain to the Information Regulator.",
      ],
    },
    {
      heading: "11. The Information Regulator",
      paragraphs: [
        "Information Regulator (South Africa), JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001. Complaints: POPIAComplaints@inforegulator.org.za. General enquiries: enquiries@inforegulator.org.za. Website: inforegulator.org.za.",
      ],
    },
    {
      heading: "12. Changes",
      paragraphs: ["We will post any change to this policy on this page and update the date above."],
    },
  ] satisfies LegalSection[],
} as const;

export const terms = {
  title: "Terms of use",
  templateNotice:
    "Template for legal review. These terms describe a hackathon prototype and must be reviewed by a legal adviser before public use.",
  updated: "Last updated: 11 November 2026",
  intro:
    "Please read these terms before using Heirloom. By creating a wallet or using the demo you agree to them.",
  sections: [
    {
      heading: "1. What Heirloom is, and is not",
      paragraphs: [
        "Heirloom is a prototype tool for recording estate instructions and carrying them out through a program on the Solana network. It is not a will. Under the Wills Act 7 of 1953 a will must be signed and witnessed on paper, and electronic wills are not currently valid in South Africa. Use Heirloom alongside a valid will that names your executor, and take legal advice.",
      ],
    },
    {
      heading: "2. Prototype status",
      paragraphs: [
        "Heirloom runs on a test network (Solana devnet) with test tokens. The program has not been audited. Do not rely on it for real assets. The demo personas, institutions' wallets and rand settlements shown in the app are simulated.",
      ],
    },
    {
      heading: "3. Your wallet",
      paragraphs: [
        "Wallets are self-custodial. Your recovery phrase is shown once and stays on your device. We cannot recover it for you. Anyone who has the phrase controls the wallet.",
      ],
    },
    {
      heading: "4. The AI agent",
      paragraphs: [
        "The agent drafts rules, reads documents and suggests prices. It can be wrong. It cannot move money beyond the limits in the program, and people you name must approve a passing and any exception. Nothing the agent says is legal, tax or financial advice.",
      ],
    },
    {
      heading: "5. Vehicles",
      paragraphs: [
        "The car's digital title controls the handover inside Heirloom. Legal ownership in South Africa is the eNaTIS registration, and the executor must complete the change of ownership.",
      ],
    },
    {
      heading: "6. Acceptable use",
      list: [
        "Do not upload documents you have no right to share.",
        "Do not submit false reports of a passing or false claims. Doing so may be a criminal offence.",
        "Do not attempt to interfere with the service or other users' estates.",
      ],
    },
    {
      heading: "7. Liability",
      paragraphs: [
        "To the extent the law allows, the prototype is provided as is, without warranties, and we are not liable for losses arising from its use. Nothing in these terms limits rights you have under the Consumer Protection Act or the Electronic Communications and Transactions Act.",
      ],
    },
    {
      heading: "8. Governing law",
      paragraphs: ["These terms are governed by the law of the Republic of South Africa."],
    },
  ] satisfies LegalSection[],
} as const;
