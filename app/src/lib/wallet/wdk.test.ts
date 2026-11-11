import { describe, expect, it } from "vitest";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { newSeedPhrase, openAccount, wdkSign } from "./wdk";

describe("WDK sign-only (offline)", () => {
  it("signs a base64 tx and returns wire bytes web3.js can parse, with the fee payer's signature", async () => {
    const acc = await openAccount(await newSeedPhrase(), "https://api.devnet.solana.com");
    const payer = new PublicKey(acc.address);
    const tx = new Transaction({ feePayer: payer, recentBlockhash: "11111111111111111111111111111111" })
      .add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: 1 }));
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    const { signature, wireBase64 } = await wdkSign(acc.account, b64);
    const parsed = Transaction.from(Buffer.from(wireBase64, "base64"));
    expect(parsed.verifySignatures()).toBe(true);
    expect(bs58.encode(parsed.signature!)).toBe(signature);
    acc.manager.dispose();
  });
});
