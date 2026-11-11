/**
 * Types and a merge for translated copy. English content files are `as const`, so their strings are
 * literal types; translations must match the English *shape* with any string in each slot.
 */

/** The English shape with every string widened to `string`. Arrays and tuples keep their length. */
export type Widen<T> = T extends string ? string : T extends number | boolean | null | undefined ? T : { [K in keyof T]: Widen<T[K]> };

/**
 * A partial translation: any object key may be left out (English shows instead). Arrays are all or
 * nothing, so a list never mixes languages. Unknown keys still fail type-checking.
 */
export type DeepPartial<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? Widen<T>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Overlays a (possibly partial) translation onto the English copy. Missing or empty slots fall back to English. */
export function mergeCopy<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (typeof base === "string") return (typeof over === "string" && over.length > 0 ? over : base) as T;
  if (Array.isArray(base)) return (Array.isArray(over) && over.length === base.length ? over : base) as T;
  if (isPlainObject(base) && isPlainObject(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) out[k] = k in base ? mergeCopy(base[k], over[k]) : over[k];
    return out as T;
  }
  return base;
}
