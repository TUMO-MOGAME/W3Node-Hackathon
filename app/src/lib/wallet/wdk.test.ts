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

describe("WDK partial signing (sponsored fees, offline)", () => {
  it("user signs a tx whose fee payer is the sponsor, then the sponsor co-signs; web3.js verifies both", async () => {
    const { wdkPartialSign } = await import("./wdk");
    const userAcc = await openAccount(await newSeedPhrase(), "https://api.devnet.solana.com");
    const sponsorAcc = await openAccount(await newSeedPhrase(), "https://api.devnet.solana.com");
    const user = new PublicKey(userAcc.address), sponsor = new PublicKey(sponsorAcc.address);
    const tx = new Transaction({ feePayer: sponsor, recentBlockhash: "11111111111111111111111111111111" })
      .add(SystemProgram.transfer({ fromPubkey: user, toPubkey: user, lamports: 1 }));
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");

    const partial = await wdkPartialSign(userAcc.account, b64);
    const p1 = Transaction.from(Buffer.from(partial.wireBase64, "base64"));
    expect(p1.signatures[0].signature).toBeNull(); // sponsor slot still empty
    expect(p1.verifySignatures(false)).toBe(true);

    const full = await wdkPartialSign(sponsorAcc.account, partial.wireBase64);
    const p2 = Transaction.from(Buffer.from(full.wireBase64, "base64"));
    expect(p2.verifySignatures()).toBe(true);
    expect(bs58.encode(p2.signature!)).toBe(full.signature); // tx id = fee payer's signature
    await expect(wdkPartialSign((await openAccount(await newSeedPhrase(), "https://api.devnet.solana.com")).account, b64)).rejects.toThrow(/not a signer/);
    userAcc.manager.dispose(); sponsorAcc.manager.dispose();
  });
});
