/**
 * ZAR off-ramp: how a paid claim settles in rand to the institution. For the hackathon this is a
 * SIMULATED provider: it only describes the payout a licensed provider would make. Real providers
 * (FSCA-licensed, CARF/SARS reporting) are the post-hackathon step: Luno Settlements (ZAR payouts to
 * third parties via API) or Stables (USD₮→ZAR with PayShap / EFT).
 */
import type { FxRate } from "./types";
import { fromBase } from "./format";

export interface PayoutRequest {
  claimTx: string;            // Solana signature of execute_claim (USD₮ landed in the institution's wallet)
  amountBase: bigint;         // USD₮ base units
  institutionName: string;
  reference: string;          // e.g. student number / invoice number
}

export interface PayoutQuote {
  provider: string;
  simulated: boolean;
  rail: "PayShap" | "EFT";
  usdt: number;
  rate: number;
  feeZar: number;
  zarToInstitution: number;
  eta: string;
  steps: string[];
}

export interface OffRampProvider {
  name: string;
  quote(req: PayoutRequest, fx: FxRate): Promise<PayoutQuote>;
}

export class SimulatedZarPayout implements OffRampProvider {
  name = "Simulated ZAR payout (Luno Settlements / Stables in production)";
  constructor(private feeBps = 50) {}

  async quote(req: PayoutRequest, fx: FxRate): Promise<PayoutQuote> {
    const usdt = fromBase(req.amountBase);
    const gross = usdt * fx.usdtZar;
    const feeZar = Math.round(gross * this.feeBps) / 10_000;
    const zar = Math.round((gross - feeZar) * 100) / 100;
    const rail = zar <= 50_000 ? "PayShap" : "EFT"; // PayShap per-payment limit is lower than EFT
    return {
      provider: this.name,
      simulated: true,
      rail,
      usdt,
      rate: fx.usdtZar,
      feeZar,
      zarToInstitution: zar,
      eta: rail === "PayShap" ? "seconds" : "same business day",
      steps: [
        `USD₮ ${usdt.toFixed(2)} arrived in ${req.institutionName}'s verified wallet (tx ${req.claimTx.slice(0, 8)}…).`,
        `A licensed off-ramp converts at ${fx.usdtZar.toFixed(2)} ZAR/USD₮ (${fx.source}).`,
        `R ${zar.toLocaleString("en-ZA")} is paid to the institution's bank account via ${rail} with reference "${req.reference}".`,
        "SIMULATED: no rand moves in this demo.",
      ],
    };
  }
}
