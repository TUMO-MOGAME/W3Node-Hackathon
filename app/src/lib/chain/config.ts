/**
 * Chain configuration from public env. Only NEXT_PUBLIC_* values live here, so this module is
 * safe in the browser. Server-only secrets (agent seed, API keys) are read in their own modules.
 */
export type Cluster = "devnet" | "mainnet-beta" | "testnet" | "localnet";

const DEFAULT_RPC: Record<Cluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://127.0.0.1:8899",
};

/** Official USD₮ SPL mint on Solana mainnet (6 decimals). Devnet uses our own test mint. */
export const MAINNET_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

function readCluster(): Cluster {
  const c = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  return c === "mainnet-beta" || c === "testnet" || c === "localnet" ? c : "devnet";
}

export const chainConfig = {
  cluster: readCluster(),
  get rpcUrl(): string {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC[this.cluster];
  },
  /** Base58 program id, empty when not yet deployed. */
  programId: process.env.NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID ?? "",
  /** Base58 USD₮ mint the estate is configured with (devnet: our 6-dp test mint). */
  usdtMint: process.env.NEXT_PUBLIC_USDT_MINT ?? (readCluster() === "mainnet-beta" ? MAINNET_USDT_MINT : ""),
  dataMode: process.env.NEXT_PUBLIC_DATA_MODE === "chain" ? ("chain" as const) : ("mock" as const),
};

export class ChainConfigError extends Error {
  constructor(what: string) {
    super(`${what} is not configured. Set it in .env.local (see app/.env.example).`);
    this.name = "ChainConfigError";
  }
}

export function requireProgramId(): string {
  if (!chainConfig.programId) throw new ChainConfigError("NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID");
  return chainConfig.programId;
}

export function requireUsdtMint(): string {
  if (!chainConfig.usdtMint) throw new ChainConfigError("NEXT_PUBLIC_USDT_MINT");
  return chainConfig.usdtMint;
}
