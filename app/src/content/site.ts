/** Brand, metadata and footer copy. Shared by every public page. */
export const site = {
  name: "Heirloom",
  shortName: "Heirloom",
  tagline: "Plan for your family, now and after you're gone.",
  title: "Heirloom: plan for your family, now and after you're gone",
  description:
    "Set up a family plan in plain language. Heirloom pays allowances and school fees on schedule from a secure USD₮ vault today, and keeps paying the university directly after you're gone. Built with Tether WDK on Solana.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://heirloom.tumoolo.tech",
  themeLight: "#ffffff",
  themeDark: "#000000",
  accent: "#000000",
  ogAlt: "Heirloom. Plan for your family, now and after you're gone. A programmable estate trust built with Tether USD₮ on Solana.",
  nav: {
    how: "How it works",
    safety: "Safety",
    proof: "Proof",
    open: "Open the app",
    demo: "Try the demo",
    home: "Heirloom home",
    skip: "Skip to content",
    menu: "Main menu",
  },
  footer: {
    blurb:
      "Heirloom works alongside your signed, witnessed will. It does not replace it. Hackathon prototype on Solana devnet; the contract has not been audited.",
    linksTitle: "Heirloom",
    legalTitle: "Legal",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#safety", label: "Safety" },
      { href: "/start", label: "Try the demo" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
    ectaTitle: "Who we are (ECTA section 43)",
    ecta: [
      { term: "Legal name", value: "[Legal name]" },
      { term: "Legal status", value: "[Legal status, e.g. sole proprietor]" },
      { term: "Registration number", value: "Not registered" },
      { term: "Physical address", value: "[Street address, suburb, city, postal code]" },
      { term: "Phone", value: "[Phone number]" },
      { term: "Email", value: "[Email address]" },
    ],
    builtWith: "Built with Tether USD₮ and WDK on Solana",
    program: "Program on Solana devnet",
    programId: process.env.NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID ?? "b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY",
    rights: "Heirloom. Hackathon prototype, W3Node Cape Town 2026.",
    // Flaticon free licence: attribution required wherever the icons appear.
    iconCredit: { label: "Icons: Uicons by Flaticon", linkText: "flaticon.com/uicons", href: "https://www.flaticon.com/uicons" },
  },
  notFound: {
    eyebrow: "Page not found",
    title: "This page isn't part of the estate.",
    body: "The link may be old, or the page may have moved. Nothing has been lost. Your vault and rules are exactly where you left them.",
    home: "Back to the start",
    app: "Open my estate",
  },
  offline: {
    title: "You're offline",
    body: "Heirloom needs a connection to read the vault and send instructions. Your wallet and rules are safe. Reconnect and try again.",
    retry: "Try again",
  },
} as const;

export type SiteCopy = typeof site;
