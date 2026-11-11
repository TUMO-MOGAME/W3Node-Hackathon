/**
 * Loads the hand-written Anchor IDL (owned by the contract agent at ./idl/heirloom.json) and builds a
 * BorshCoder from the raw (snake_case) IDL. We use the coder directly rather than `Program` so we can
 * resolve accounts ourselves by name (see ./instructions.ts) and stay tolerant of small naming drift.
 */
import { BorshCoder, type Idl } from "@anchor-lang/core";
import rawIdl from "./idl/heirloom.json";
import { chainConfig } from "./config";

type IdlTypeDef = NonNullable<Idl["types"]>[number];

let cachedCoder: BorshCoder | null = null;

/** The IDL with `address` overridden by NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID when set. */
export function getIdl(): Idl {
  const idl = rawIdl as unknown as Idl;
  return chainConfig.programId ? { ...idl, address: chainConfig.programId } : idl;
}

export function getCoder(): BorshCoder {
  if (!cachedCoder) cachedCoder = new BorshCoder(getIdl());
  return cachedCoder;
}

/** Normalises a name for loose matching: "death_threshold" == "deathThreshold" == "DeathThreshold". */
export const norm = (s: string) => s.replace(/_/g, "").toLowerCase();

export function findInstruction(name: string) {
  const ix = getIdl().instructions.find((i) => norm(i.name) === norm(name));
  if (!ix) throw new Error(`Instruction "${name}" is not in the Heirloom IDL. Is the IDL up to date?`);
  return ix;
}

export function findType(name: string): IdlTypeDef | undefined {
  return getIdl().types?.find((t) => norm(t.name) === norm(name));
}

/** The IDL's exact account name, e.g. "Estate". */
export function accountName(name: string): string {
  const acc = getIdl().accounts?.find((a) => norm(a.name) === norm(name));
  if (!acc) throw new Error(`Account type "${name}" is not in the Heirloom IDL.`);
  return acc.name;
}

export function accountDiscriminator(name: string): Uint8Array {
  const acc = getIdl().accounts?.find((a) => norm(a.name) === norm(name));
  if (!acc) throw new Error(`Account type "${name}" is not in the Heirloom IDL.`);
  return Uint8Array.from(acc.discriminator);
}

/** Builds an Anchor enum value `{ Variant: {} }` using the variant spelling the IDL uses. */
export function enumValue(typeName: string, variant: string): Record<string, Record<string, never>> {
  const t = findType(typeName);
  if (t && t.type.kind === "enum") {
    const v = t.type.variants.find((x) => norm(x.name) === norm(variant));
    if (v) return { [v.name]: {} };
  }
  throw new Error(`Enum ${typeName}::${variant} is not in the Heirloom IDL.`);
}
