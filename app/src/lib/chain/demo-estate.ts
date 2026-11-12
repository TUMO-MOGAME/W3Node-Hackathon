/**
 * The seeded devnet demo estate (scripts/seed-demo.ts): the Mokoena family, all fictional people.
 *
 * - Display names are off-chain. Without Supabase the server keeps them in memory only, so after a restart the laptop
 *   demo would show "Estate owner". These defaults fill that gap (db.ts preloads them; Supabase, when set, wins).
 * - The demo wallets also belong to a throwaway rehearsal estate (scripts/rehearse-devnet.ts), so a family member
 *   can be linked to more than one estate; the app opens this one first.
 * Public addresses only. Devnet only: never used on mainnet.
 */
import type { EstateMeta } from "../db"; // type only: erased, so no server code reaches the browser

export const DEVNET_DEMO_ESTATE = "JBdsDy67YBfpV8YAc2H1h7w95h8uJ2XUzTDh9vt34G9E";

export const DEVNET_DEMO_META: EstateMeta = {
  estate: DEVNET_DEMO_ESTATE,
  ownerWallet: "4Rd7m3i1etN66EbuLzTwkXU9dJKwwayBGg5jCyvTA5Tz",
  ownerName: "Thabo Mokoena",
  verifierNames: ["Adv. Thandi Ndlovu", "Ms. Anita Pillay", "Uncle Bongani Mokoena"],
  assetTitles: { F9FVooHEzRu92UXDmeUTNK7c1Wxgxi6xwWBRjqub5fLm: "2019 Toyota Corolla 1.8 Prestige" },
  buyerNames: { "12eMQwGSR57E2wKRt8Uwn18DWaN54GKY7HGJD8zTLaV8": "Pieter", "6n4djkebGKjD7jyJ3gGNorgPkh73bwmV1tpfRAA538F7": "Ayesha" },
};

/** The demo children's public wallets (for the demo Legacy Book). */
export const DEVNET_DEMO_CHILDREN = {
  lerato: "FXb3FikjwrPU8nR8WjJB6y4LCZ1esdw3vkUybPwMvGZZ",
  sipho: "BMiTCRtWEettDpHQvL9kBt5bkSpiNeAMZYwYUmaAybbV",
  naledi: "7MC44yaTaRQCxW3aSnzfr2deQzWw3yvw4XnrmpUewirD",
};

/**
 * Thabo is fictional, so nobody's voice can be cloned for him: the demo legacy voice is a stock ElevenLabs voice
 * ("Andreas - Warm & Welcoming", South African English), standing in for the Instant Voice Clone a real parent
 * records with consent. Override with LEGACY_DEMO_VOICE_ID.
 */
export const DEVNET_DEMO_LEGACY_VOICE = "rqZosEnZTsroRdHl7GGT";

/** Puts the demo estate first when a wallet belongs to several estates. */
export function demoEstateFirst<T extends { estate: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.estate === DEVNET_DEMO_ESTATE) - Number(a.estate === DEVNET_DEMO_ESTATE));
}
