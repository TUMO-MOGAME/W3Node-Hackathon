/**
 * Single seam between the UI and the wallet layer: the UI imports the wallet from here only.
 * Backed by the Tether WDK implementation (mock mode: fixed demo personas).
 */
export { useWallet, WalletProvider, type RequestPin, type PinReason } from "../wallet/context";
