/**
 * Browser stand-in for `sodium-universal`, aliased in next.config.ts (turbopack.resolveAlias, browser only).
 * Tether WDK's Solana account only uses `sodium_memzero` (to wipe the private key on dispose()); the browser
 * build would otherwise pull in the optional `sodium-javascript` peer, which is not installed.
 */
export function sodium_memzero(buf: Uint8Array): void {
  buf.fill(0);
}

const sodium = { sodium_memzero };
export default sodium;
