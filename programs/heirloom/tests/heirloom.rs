//! LiteSVM tests for the Heirloom program. Run `anchor build` first (loads target/deploy/heirloom.so),
//! then `cargo test -p heirloom`.
//!
//! SPL mint and token accounts are written straight into the SVM with `set_account` (hand-packed
//! SPL Token layouts), so the tests don't depend on spl-token client crates.

use anchor_lang::{
    prelude::{Clock, Pubkey},
    solana_program::instruction::Instruction,
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use heirloom::{
    AssetStatus, ClaimStatus, Estate, EstateStatus, HeirloomError, PayeeKind, Category, Rule, Claim,
    Asset,
};
use litesvm::LiteSVM;
use solana_account::Account;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

const USDT: u64 = 1_000_000; // 6 decimals
const WAITING: i64 = 120; // demo waiting period (2 minutes)
const DAY: i64 = 86_400;

// ---------------------------------------------------------------- program ids

fn token_program() -> Pubkey {
    anchor_spl::token::ID
}
fn ata_program() -> Pubkey {
    anchor_spl::associated_token::ID
}
fn system_program() -> Pubkey {
    anchor_lang::system_program::ID
}

// ---------------------------------------------------------------- PDAs

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &heirloom::id()).0
}
fn estate_pda(owner: &Pubkey) -> Pubkey {
    pda(&[b"estate", owner.as_ref()])
}
fn beneficiary_pda(estate: &Pubkey, wallet: &Pubkey) -> Pubkey {
    pda(&[b"beneficiary", estate.as_ref(), wallet.as_ref()])
}
fn payee_pda(estate: &Pubkey, wallet: &Pubkey) -> Pubkey {
    pda(&[b"payee", estate.as_ref(), wallet.as_ref()])
}
fn rule_pda(estate: &Pubkey, id: u16) -> Pubkey {
    pda(&[b"rule", estate.as_ref(), &id.to_le_bytes()])
}
fn claim_pda(rule: &Pubkey, id: u32) -> Pubkey {
    pda(&[b"claim", rule.as_ref(), &id.to_le_bytes()])
}
fn asset_pda(estate: &Pubkey, nft_mint: &Pubkey) -> Pubkey {
    pda(&[b"asset", estate.as_ref(), nft_mint.as_ref()])
}
fn offer_pda(asset: &Pubkey, buyer: &Pubkey) -> Pubkey {
    pda(&[b"offer", asset.as_ref(), buyer.as_ref()])
}
fn hardship_pda(asset: &Pubkey, wallet: &Pubkey) -> Pubkey {
    pda(&[b"hardship", asset.as_ref(), wallet.as_ref()])
}
fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[owner.as_ref(), token_program().as_ref(), mint.as_ref()],
        &ata_program(),
    )
    .0
}

// ---------------------------------------------------------------- raw SPL Token state

fn pack_mint(authority: &Pubkey, supply: u64, decimals: u8) -> Vec<u8> {
    let mut d = Vec::with_capacity(82);
    d.extend_from_slice(&1u32.to_le_bytes()); // mint_authority: Some
    d.extend_from_slice(authority.as_ref());
    d.extend_from_slice(&supply.to_le_bytes());
    d.push(decimals);
    d.push(1); // is_initialized
    d.extend_from_slice(&0u32.to_le_bytes()); // freeze_authority: None
    d.extend_from_slice(&[0u8; 32]);
    assert_eq!(d.len(), 82);
    d
}

fn pack_token_account(mint: &Pubkey, owner: &Pubkey, amount: u64) -> Vec<u8> {
    let mut d = Vec::with_capacity(165);
    d.extend_from_slice(mint.as_ref());
    d.extend_from_slice(owner.as_ref());
    d.extend_from_slice(&amount.to_le_bytes());
    d.extend_from_slice(&0u32.to_le_bytes()); // delegate: None
    d.extend_from_slice(&[0u8; 32]);
    d.push(1); // state: Initialized
    d.extend_from_slice(&0u32.to_le_bytes()); // is_native: None
    d.extend_from_slice(&0u64.to_le_bytes());
    d.extend_from_slice(&0u64.to_le_bytes()); // delegated_amount
    d.extend_from_slice(&0u32.to_le_bytes()); // close_authority: None
    d.extend_from_slice(&[0u8; 32]);
    assert_eq!(d.len(), 165);
    d
}

fn set_token_state(svm: &mut LiteSVM, address: Pubkey, data: Vec<u8>) {
    let lamports = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        address,
        Account {
            lamports,
            data,
            owner: token_program(),
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn create_mint(svm: &mut LiteSVM, authority: &Pubkey, supply: u64, decimals: u8) -> Pubkey {
    let mint = Keypair::new().pubkey();
    set_token_state(svm, mint, pack_mint(authority, supply, decimals));
    mint
}

/// Creates (or overwrites) `owner`'s ATA for `mint` holding `amount`.
fn fund_ata(svm: &mut LiteSVM, owner: &Pubkey, mint: &Pubkey, amount: u64) -> Pubkey {
    let address = ata(owner, mint);
    set_token_state(svm, address, pack_token_account(mint, owner, amount));
    address
}

fn balance(svm: &LiteSVM, token_account: &Pubkey) -> u64 {
    match svm.get_account(token_account) {
        Some(acc) if acc.data.len() >= 72 => u64::from_le_bytes(acc.data[64..72].try_into().unwrap()),
        _ => 0,
    }
}

fn is_closed(svm: &LiteSVM, address: &Pubkey) -> bool {
    svm.get_account(address).map_or(true, |a| a.lamports == 0)
}

fn fetch<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let acc = svm.get_account(address).expect("account missing");
    T::try_deserialize(&mut acc.data.as_slice()).expect("deserialize")
}

// ---------------------------------------------------------------- tx helpers

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction::new_with_bytes(heirloom::id(), &data.data(), accounts.to_account_metas(None))
}

/// Sends one instruction; `signers[0]` pays the fee. Returns the debug form of the error on failure.
fn send(svm: &mut LiteSVM, instruction: Instruction, signers: &[&Keypair]) -> Result<(), String> {
    let payer = signers[0].pubkey();
    let msg = Message::new_with_blockhash(&[instruction], Some(&payer), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    let res = svm.send_transaction(tx);
    svm.expire_blockhash();
    res.map(|_| ()).map_err(|e| format!("{:?}", e.err))
}

fn expect_err<T>(res: Result<T, String>, err: HeirloomError) {
    let code = 6000 + err as u32;
    match res {
        Ok(_) => panic!("expected error {code}, but the transaction succeeded"),
        Err(e) => assert!(
            e.contains(&format!("Custom({code})")),
            "expected Custom({code}), got {e}"
        ),
    }
}

fn now(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<Clock>().unix_timestamp
}

fn warp(svm: &mut LiteSVM, secs: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp += secs;
    clock.slot += 1;
    svm.set_sysvar::<Clock>(&clock);
}

// ---------------------------------------------------------------- test environment

struct Env {
    svm: LiteSVM,
    owner: Keypair,
    agent: Keypair,
    verifiers: [Keypair; 3],
    kid1: Keypair,
    kid2: Keypair,
    university: Keypair,
    landlord: Keypair,
    executor: Keypair,
    buyer1: Keypair,
    buyer2: Keypair,
    stranger: Keypair,
    usdt_mint: Pubkey,
    estate: Pubkey,
}

impl Env {
    /// Program loaded, wallets funded with SOL, USD₮ mint created, owner holds 100k USD₮.
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/heirloom.so"));
        svm.add_program(heirloom::id(), bytes).unwrap();

        let owner = Keypair::new();
        let env_keys: Vec<Keypair> = (0..11).map(|_| Keypair::new()).collect();
        let mut it = env_keys.into_iter();
        let mut next = || it.next().unwrap();
        let agent = next();
        let verifiers = [next(), next(), next()];
        let kid1 = next();
        let kid2 = next();
        let university = next();
        let landlord = next();
        let executor = next();
        let buyer1 = next();
        let buyer2 = next();
        let stranger = Keypair::new();

        for kp in [&owner, &agent, &verifiers[0], &verifiers[1], &verifiers[2], &kid1, &kid2, &buyer1, &buyer2, &stranger] {
            svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        }

        let usdt_mint = create_mint(&mut svm, &owner.pubkey(), 1_000_000 * USDT, 6);
        fund_ata(&mut svm, &owner.pubkey(), &usdt_mint, 100_000 * USDT);
        let estate = estate_pda(&owner.pubkey());

        Env {
            svm,
            owner,
            agent,
            verifiers,
            kid1,
            kid2,
            university,
            landlord,
            executor,
            buyer1,
            buyer2,
            stranger,
            usdt_mint,
            estate,
        }
    }

    fn vault(&self) -> Pubkey {
        ata(&self.estate, &self.usdt_mint)
    }

    fn verifier_keys(&self) -> [Pubkey; 3] {
        [self.verifiers[0].pubkey(), self.verifiers[1].pubkey(), self.verifiers[2].pubkey()]
    }

    fn create_estate_ix(&self, verifiers: [Pubkey; 3], death: u8, claim: u8, hardship: u8, waiting: i64) -> Instruction {
        ix(
            heirloom::accounts::CreateEstate {
                owner: self.owner.pubkey(),
                estate: self.estate,
                usdt_mint: self.usdt_mint,
                vault: self.vault(),
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::CreateEstate {
                agent: self.agent.pubkey(),
                verifiers,
                death_threshold: death,
                claim_threshold: claim,
                hardship_threshold: hardship,
                waiting_period_secs: waiting,
            },
        )
    }

    fn create_estate(&mut self) {
        let i = self.create_estate_ix(self.verifier_keys(), 2, 1, 2, WAITING);
        send(&mut self.svm, i, &[&self.owner]).unwrap();
    }

    fn add_beneficiary(&mut self, wallet: Pubkey, label: &str) {
        let i = ix(
            heirloom::accounts::AddBeneficiary {
                owner: self.owner.pubkey(),
                estate: self.estate,
                wallet,
                beneficiary: beneficiary_pda(&self.estate, &wallet),
                system_program: system_program(),
            },
            heirloom::instruction::AddBeneficiary { label: label.to_string() },
        );
        send(&mut self.svm, i, &[&self.owner]).unwrap();
    }

    fn add_payee(&mut self, wallet: Pubkey, kind: PayeeKind, name: &str) {
        let i = ix(
            heirloom::accounts::AddPayee {
                owner: self.owner.pubkey(),
                estate: self.estate,
                wallet,
                payee: payee_pda(&self.estate, &wallet),
                system_program: system_program(),
            },
            heirloom::instruction::AddPayee { kind, name: name.to_string() },
        );
        send(&mut self.svm, i, &[&self.owner]).unwrap();
    }

    fn add_rule(&mut self, id: u16, wallet: Pubkey, kind: PayeeKind, max_per_claim: u64, lifetime_cap: u64, valid_until: i64) -> Pubkey {
        let i = self.add_rule_ix(id, wallet, kind, max_per_claim, lifetime_cap, valid_until, false, 0, 0, 0, None);
        send(&mut self.svm, i, &[&self.owner]).unwrap();
        rule_pda(&self.estate, id)
    }

    /// Full add_rule: living plan (`starts_now`) and/or a scheduled payment to `payee_wallet`.
    fn add_rule_ix(
        &self,
        id: u16,
        wallet: Pubkey,
        kind: PayeeKind,
        max_per_claim: u64,
        lifetime_cap: u64,
        valid_until: i64,
        starts_now: bool,
        recurring_amount: u64,
        interval_secs: i64,
        first_due: i64,
        payee_wallet: Option<Pubkey>,
    ) -> Instruction {
        ix(
            heirloom::accounts::AddRule {
                owner: self.owner.pubkey(),
                estate: self.estate,
                beneficiary: beneficiary_pda(&self.estate, &wallet),
                rule: rule_pda(&self.estate, id),
                payee: payee_wallet.map(|w| payee_pda(&self.estate, &w)),
                system_program: system_program(),
            },
            heirloom::instruction::AddRule {
                category: Category::Tuition,
                allowed_payee_kind: kind,
                max_per_claim,
                lifetime_cap,
                valid_until,
                starts_now,
                recurring_amount,
                interval_secs,
                first_due,
            },
        )
    }

    fn owner_approve_claim(&mut self, rule: Pubkey, claim: Pubkey) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::OwnerApproveClaim { owner: self.owner.pubkey(), estate: self.estate, rule, claim },
            heirloom::instruction::OwnerApproveClaim {},
        );
        send(&mut self.svm, i, &[&self.owner])
    }

    fn execute_scheduled(&mut self, rule: Pubkey) -> Result<(), String> {
        let r: Rule = fetch(&self.svm, &rule);
        let i = ix(
            heirloom::accounts::ExecuteScheduled {
                payer: self.stranger.pubkey(),
                estate: self.estate,
                rule,
                payee_wallet: r.fixed_payee,
                usdt_mint: self.usdt_mint,
                vault: self.vault(),
                payee_usdt: ata(&r.fixed_payee, &self.usdt_mint),
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::ExecuteScheduled {},
        );
        send(&mut self.svm, i, &[&self.stranger])
    }

    fn deposit_ix(&self, owner_usdt: Pubkey, amount: u64) -> Instruction {
        ix(
            heirloom::accounts::Deposit {
                owner: self.owner.pubkey(),
                estate: self.estate,
                usdt_mint: self.usdt_mint,
                owner_usdt,
                vault: self.vault(),
                token_program: token_program(),
            },
            heirloom::instruction::Deposit { amount },
        )
    }

    fn submit_death_claim(&mut self, who: usize) -> Result<(), String> {
        let kid = if who == 1 { &self.kid1 } else { &self.kid2 };
        let i = ix(
            heirloom::accounts::SubmitDeathClaim {
                beneficiary: kid.pubkey(),
                estate: self.estate,
                beneficiary_account: beneficiary_pda(&self.estate, &kid.pubkey()),
            },
            heirloom::instruction::SubmitDeathClaim { cert_hash: [7u8; 32] },
        );
        send(&mut self.svm, i, &[kid])
    }

    fn review_death(&mut self, approve: bool) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::ReviewDeath { agent: self.agent.pubkey(), estate: self.estate },
            heirloom::instruction::ReviewDeath { approve, report_hash: [9u8; 32] },
        );
        send(&mut self.svm, i, &[&self.agent])
    }

    fn attest_death_by(&mut self, signer: &Keypair) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::AttestDeath { verifier: signer.pubkey(), estate: self.estate },
            heirloom::instruction::AttestDeath {},
        );
        send(&mut self.svm, i, &[signer])
    }

    fn attest_death(&mut self, v: usize) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::AttestDeath { verifier: self.verifiers[v].pubkey(), estate: self.estate },
            heirloom::instruction::AttestDeath {},
        );
        send(&mut self.svm, i, &[&self.verifiers[v]])
    }

    fn veto_death(&mut self) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::VetoDeath { owner: self.owner.pubkey(), estate: self.estate },
            heirloom::instruction::VetoDeath {},
        );
        send(&mut self.svm, i, &[&self.owner])
    }

    fn finalize_unlock(&mut self) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::FinalizeUnlock { estate: self.estate },
            heirloom::instruction::FinalizeUnlock {},
        );
        send(&mut self.svm, i, &[&self.stranger])
    }

    fn estate_state(&self) -> Estate {
        fetch(&self.svm, &self.estate)
    }

    /// Runs the full death flow through to Unlocked.
    fn unlock(&mut self) {
        self.submit_death_claim(1).unwrap();
        self.review_death(true).unwrap();
        self.attest_death(0).unwrap();
        self.attest_death(1).unwrap();
        warp(&mut self.svm, WAITING);
        self.finalize_unlock().unwrap();
        assert_eq!(self.estate_state().status, EstateStatus::Unlocked);
    }

    /// Estate with kid1 + kid2, a university and a landlord payee, and 5,000 USD₮ in the vault.
    fn configured() -> Self {
        let mut env = Env::new();
        env.create_estate();
        let (k1, k2) = (env.kid1.pubkey(), env.kid2.pubkey());
        env.add_beneficiary(k1, "Child 1");
        env.add_beneficiary(k2, "Child 2");
        let (uni, ll) = (env.university.pubkey(), env.landlord.pubkey());
        env.add_payee(uni, PayeeKind::University, "University of Cape Town");
        env.add_payee(ll, PayeeKind::Landlord, "Res Landlord");
        let owner_usdt = ata(&env.owner.pubkey(), &env.usdt_mint);
        let i = env.deposit_ix(owner_usdt, 5_000 * USDT);
        send(&mut env.svm, i, &[&env.owner]).unwrap();
        env
    }

    // ---------------- claims

    fn submit_claim(&mut self, signer_is_kid1: bool, rule: Pubkey, payee_wallet: Pubkey, amount: u64) -> Result<Pubkey, String> {
        let kid = if signer_is_kid1 { &self.kid1 } else { &self.kid2 };
        let r: Rule = fetch(&self.svm, &rule);
        let claim = claim_pda(&rule, r.claim_count);
        let i = ix(
            heirloom::accounts::SubmitClaim {
                beneficiary: kid.pubkey(),
                estate: self.estate,
                beneficiary_account: beneficiary_pda(&self.estate, &kid.pubkey()),
                rule,
                payee: payee_pda(&self.estate, &payee_wallet),
                claim,
                system_program: system_program(),
            },
            heirloom::instruction::SubmitClaim { amount, evidence_hash: [1u8; 32] },
        );
        send(&mut self.svm, i, &[kid]).map(|_| claim)
    }

    fn review_claim(&mut self, claim: Pubkey, approve: bool) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::ReviewClaim { agent: self.agent.pubkey(), estate: self.estate, claim },
            heirloom::instruction::ReviewClaim { approve, report_hash: [2u8; 32] },
        );
        send(&mut self.svm, i, &[&self.agent])
    }

    fn approve_claim(&mut self, claim: Pubkey, v: usize) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::ApproveClaim { verifier: self.verifiers[v].pubkey(), estate: self.estate, claim },
            heirloom::instruction::ApproveClaim {},
        );
        send(&mut self.svm, i, &[&self.verifiers[v]])
    }

    fn execute_claim(&mut self, rule: Pubkey, claim: Pubkey) -> Result<(), String> {
        let c: Claim = fetch(&self.svm, &claim);
        let i = ix(
            heirloom::accounts::ExecuteClaim {
                payer: self.stranger.pubkey(),
                estate: self.estate,
                rule,
                claim,
                payee_wallet: c.payee,
                usdt_mint: self.usdt_mint,
                vault: self.vault(),
                payee_usdt: ata(&c.payee, &self.usdt_mint),
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::ExecuteClaim {},
        );
        send(&mut self.svm, i, &[&self.stranger])
    }

    /// Submit -> agent approves -> verifier 0 approves -> execute.
    fn pay_claim(&mut self, rule: Pubkey, payee_wallet: Pubkey, amount: u64) {
        let claim = self.submit_claim(true, rule, payee_wallet, amount).unwrap();
        self.review_claim(claim, true).unwrap();
        self.approve_claim(claim, 0).unwrap();
        self.execute_claim(rule, claim).unwrap();
    }
}

// ---------------------------------------------------------------- sale environment

struct Sale {
    env: Env,
    nft_mint: Pubkey,
    asset: Pubkey,
}

const FLOOR: u64 = 9_000 * USDT;
const HARDSHIP_FLOOR: u64 = 7_000 * USDT;
const ASKING: u64 = 10_000 * USDT;

impl Sale {
    /// Configured estate + registered car NFT, unlocked, listed for 3 days; buyers hold 20k USD₮.
    fn new() -> Self {
        let mut env = Env::configured();
        let owner = env.owner.pubkey();
        let nft_mint = create_mint(&mut env.svm, &owner, 1, 0);
        let owner_nft = fund_ata(&mut env.svm, &owner, &nft_mint, 1);
        let asset = asset_pda(&env.estate, &nft_mint);

        let i = ix(
            heirloom::accounts::RegisterAsset {
                owner,
                estate: env.estate,
                nft_mint,
                owner_nft,
                nft_escrow: ata(&env.estate, &nft_mint),
                asset,
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::RegisterAsset {
                floor_price: FLOOR,
                hardship_floor: HARDSHIP_FLOOR,
                asking_price: ASKING,
                proceeds_to: env.executor.pubkey(),
                doc_hash: [3u8; 32],
            },
        );
        send(&mut env.svm, i, &[&env.owner]).unwrap();
        assert_eq!(balance(&env.svm, &ata(&env.estate, &nft_mint)), 1);
        assert_eq!(balance(&env.svm, &owner_nft), 0);

        env.unlock();

        let i = ix(
            heirloom::accounts::ListAsset { authority: env.agent.pubkey(), estate: env.estate, asset },
            heirloom::instruction::ListAsset { duration_secs: 3 * DAY },
        );
        send(&mut env.svm, i, &[&env.agent]).unwrap();

        let mint = env.usdt_mint;
        let (b1, b2) = (env.buyer1.pubkey(), env.buyer2.pubkey());
        fund_ata(&mut env.svm, &b1, &mint, 20_000 * USDT);
        fund_ata(&mut env.svm, &b2, &mint, 20_000 * USDT);

        Sale { env, nft_mint, asset }
    }

    fn buyer(&self, n: usize) -> &Keypair {
        if n == 1 { &self.env.buyer1 } else { &self.env.buyer2 }
    }

    fn place_offer(&mut self, n: usize, amount: u64) -> Result<(), String> {
        let buyer = self.buyer(n).pubkey();
        let offer = offer_pda(&self.asset, &buyer);
        let i = ix(
            heirloom::accounts::PlaceOffer {
                buyer,
                estate: self.env.estate,
                asset: self.asset,
                usdt_mint: self.env.usdt_mint,
                buyer_usdt: ata(&buyer, &self.env.usdt_mint),
                offer,
                offer_escrow: ata(&offer, &self.env.usdt_mint),
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::PlaceOffer { amount },
        );
        let kp = if n == 1 { &self.env.buyer1 } else { &self.env.buyer2 };
        send(&mut self.env.svm, i, &[kp])
    }

    fn withdraw_offer(&mut self, n: usize) -> Result<(), String> {
        let buyer = self.buyer(n).pubkey();
        let offer = offer_pda(&self.asset, &buyer);
        let i = ix(
            heirloom::accounts::WithdrawOffer {
                buyer,
                estate: self.env.estate,
                asset: self.asset,
                usdt_mint: self.env.usdt_mint,
                buyer_usdt: ata(&buyer, &self.env.usdt_mint),
                offer,
                offer_escrow: ata(&offer, &self.env.usdt_mint),
                token_program: token_program(),
            },
            heirloom::instruction::WithdrawOffer {},
        );
        let kp = if n == 1 { &self.env.buyer1 } else { &self.env.buyer2 };
        send(&mut self.env.svm, i, &[kp])
    }

    fn accept_offer(&mut self, n: usize) -> Result<(), String> {
        let buyer = self.buyer(n).pubkey();
        let offer = offer_pda(&self.asset, &buyer);
        let a: Asset = fetch(&self.env.svm, &self.asset);
        let recipient = a.hardship_beneficiary.unwrap_or(a.proceeds_to);
        let i = ix(
            heirloom::accounts::AcceptOffer {
                agent: self.env.agent.pubkey(),
                estate: self.env.estate,
                asset: self.asset,
                offer,
                buyer,
                recipient,
                usdt_mint: self.env.usdt_mint,
                offer_escrow: ata(&offer, &self.env.usdt_mint),
                recipient_usdt: ata(&recipient, &self.env.usdt_mint),
                nft_mint: self.nft_mint,
                nft_escrow: ata(&self.env.estate, &self.nft_mint),
                buyer_nft: ata(&buyer, &self.nft_mint),
                token_program: token_program(),
                associated_token_program: ata_program(),
                system_program: system_program(),
            },
            heirloom::instruction::AcceptOffer {},
        );
        send(&mut self.env.svm, i, &[&self.env.agent])
    }

    fn submit_hardship(&mut self) -> Result<Pubkey, String> {
        let kid = self.env.kid2.pubkey();
        let hardship = hardship_pda(&self.asset, &kid);
        let i = ix(
            heirloom::accounts::SubmitHardship {
                beneficiary: kid,
                estate: self.env.estate,
                beneficiary_account: beneficiary_pda(&self.env.estate, &kid),
                asset: self.asset,
                hardship,
                system_program: system_program(),
            },
            heirloom::instruction::SubmitHardship { evidence_hash: [4u8; 32] },
        );
        send(&mut self.env.svm, i, &[&self.env.kid2]).map(|_| hardship)
    }

    fn review_hardship(&mut self, hardship: Pubkey, approve: bool) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::ReviewHardship {
                agent: self.env.agent.pubkey(),
                estate: self.env.estate,
                asset: self.asset,
                hardship,
            },
            heirloom::instruction::ReviewHardship { approve, report_hash: [5u8; 32] },
        );
        send(&mut self.env.svm, i, &[&self.env.agent])
    }

    fn approve_hardship(&mut self, hardship: Pubkey, v: usize) -> Result<(), String> {
        let i = ix(
            heirloom::accounts::ApproveHardship {
                verifier: self.env.verifiers[v].pubkey(),
                estate: self.env.estate,
                asset: self.asset,
                hardship,
            },
            heirloom::instruction::ApproveHardship {},
        );
        send(&mut self.env.svm, i, &[&self.env.verifiers[v]])
    }

    /// kid2's hardship: submitted, agent-approved, and approved by 2 of 3 verifiers.
    fn approved_hardship(&mut self) {
        let h = self.submit_hardship().unwrap();
        self.review_hardship(h, true).unwrap();
        self.approve_hardship(h, 0).unwrap();
        self.approve_hardship(h, 2).unwrap();
        let a: Asset = fetch(&self.env.svm, &self.asset);
        assert_eq!(a.hardship_beneficiary, Some(self.env.kid2.pubkey()));
    }
}

// =================================================================== tests: setup

#[test]
fn create_estate_validation() {
    let mut env = Env::new();
    let v = env.verifier_keys();
    let owner = env.owner.pubkey();

    let i = env.create_estate_ix(v, 0, 1, 2, WAITING);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::InvalidThreshold);

    let i = env.create_estate_ix(v, 2, 4, 2, WAITING);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::InvalidThreshold);

    let i = env.create_estate_ix(v, 2, 1, 2, -1);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::InvalidThreshold);

    let i = env.create_estate_ix([v[0], v[0], v[2]], 2, 1, 2, WAITING);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::DuplicateVerifier);

    let i = env.create_estate_ix([v[0], owner, v[2]], 2, 1, 2, WAITING);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::DuplicateVerifier);

    env.create_estate();
    let e = env.estate_state();
    assert_eq!(e.owner, owner);
    assert_eq!(e.agent, env.agent.pubkey());
    assert_eq!(e.usdt_mint, env.usdt_mint);
    assert_eq!(e.verifiers, v);
    assert_eq!((e.death_threshold, e.claim_threshold, e.hardship_threshold), (2, 1, 2));
    assert_eq!(e.status, EstateStatus::Active);
    assert_eq!(e.last_heartbeat, now(&env.svm));
    assert!(env.svm.get_account(&env.vault()).is_some(), "vault ATA created");
}

#[test]
fn deposit_and_withdraw_respect_mint_and_status() {
    let mut env = Env::configured();
    assert_eq!(balance(&env.svm, &env.vault()), 5_000 * USDT);

    // A token account of another mint is rejected.
    let fake_mint = create_mint(&mut env.svm, &env.owner.pubkey(), 1_000 * USDT, 6);
    let owner = env.owner.pubkey();
    let fake_ata = fund_ata(&mut env.svm, &owner, &fake_mint, 1_000 * USDT);
    let i = env.deposit_ix(fake_ata, 10 * USDT);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::WrongMint);

    // Owner can withdraw while Active.
    let owner_usdt = ata(&owner, &env.usdt_mint);
    let withdraw = |env: &Env, amount: u64| {
        ix(
            heirloom::accounts::Withdraw {
                owner: env.owner.pubkey(),
                estate: env.estate,
                usdt_mint: env.usdt_mint,
                owner_usdt,
                vault: env.vault(),
                token_program: token_program(),
            },
            heirloom::instruction::Withdraw { amount },
        )
    };
    let i = withdraw(&env, 1_000 * USDT);
    send(&mut env.svm, i, &[&env.owner]).unwrap();
    assert_eq!(balance(&env.svm, &env.vault()), 4_000 * USDT);

    // ...but not after unlock.
    env.unlock();
    let i = withdraw(&env, 1 * USDT);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::BadStatus);
}

// =================================================================== tests: death flow

#[test]
fn death_flow_unlocks_after_quorum_and_waiting_period() {
    let mut env = Env::configured();

    env.submit_death_claim(1).unwrap();
    // A second claim can't reset the open one.
    expect_err(env.submit_death_claim(2), HeirloomError::BadStatus);
    // Verifiers can't attest before the agent approves.
    expect_err(env.attest_death(0), HeirloomError::AgentNotApproved);

    env.review_death(true).unwrap();
    env.attest_death(0).unwrap();
    expect_err(env.attest_death(0), HeirloomError::AlreadyApproved);
    let stranger = Keypair::new();
    env.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    expect_err(env.attest_death_by(&stranger), HeirloomError::NotVerifier);
    assert_eq!(env.estate_state().status, EstateStatus::Active);

    env.attest_death(1).unwrap();
    let e = env.estate_state();
    assert_eq!(e.status, EstateStatus::DeathPending);
    assert_eq!(e.death_attestations, 0b011);
    let since = e.death_pending_since;

    // Unlock before the waiting period fails.
    expect_err(env.finalize_unlock(), HeirloomError::WaitingPeriodNotOver);
    warp(&mut env.svm, WAITING - 10);
    expect_err(env.finalize_unlock(), HeirloomError::WaitingPeriodNotOver);

    // A third attestation doesn't restart the timer.
    env.attest_death(2).unwrap();
    assert_eq!(env.estate_state().death_pending_since, since);

    warp(&mut env.svm, 10);
    env.finalize_unlock().unwrap();
    assert_eq!(env.estate_state().status, EstateStatus::Unlocked);

    // Owner can't veto after unlock.
    expect_err(env.veto_death(), HeirloomError::BadStatus);
}

#[test]
fn veto_resets_death_claim() {
    let mut env = Env::configured();
    env.submit_death_claim(1).unwrap();
    env.review_death(true).unwrap();
    env.attest_death(0).unwrap();
    env.attest_death(1).unwrap();
    assert_eq!(env.estate_state().status, EstateStatus::DeathPending);

    warp(&mut env.svm, 30);
    env.veto_death().unwrap();
    let e = env.estate_state();
    assert_eq!(e.status, EstateStatus::Active);
    assert_eq!(e.death_cert_hash, [0u8; 32]);
    assert_eq!(e.death_attestations, 0);
    assert_eq!(e.last_heartbeat, now(&env.svm));

    warp(&mut env.svm, WAITING);
    expect_err(env.finalize_unlock(), HeirloomError::BadStatus);

    // A fresh claim starts again from zero.
    env.submit_death_claim(2).unwrap();
    expect_err(env.attest_death(0), HeirloomError::AgentNotApproved);
}

#[test]
fn agent_rejection_clears_death_claim() {
    let mut env = Env::configured();
    env.submit_death_claim(1).unwrap();
    env.review_death(false).unwrap();
    let e = env.estate_state();
    assert_eq!(e.death_cert_hash, [0u8; 32]);
    expect_err(env.attest_death(0), HeirloomError::NoDeathClaim);
}

// =================================================================== tests: claims

fn claims_env() -> (Env, Pubkey) {
    let mut env = Env::configured();
    let valid_until = now(&env.svm) + 365 * DAY;
    let kid1 = env.kid1.pubkey();
    // Tuition for kid1, paid to a University: 600 per claim, 1,000 lifetime.
    let rule = env.add_rule(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until);
    (env, rule)
}

#[test]
fn claim_before_unlock_fails() {
    let (mut env, rule) = claims_env();
    let uni = env.university.pubkey();
    expect_err(env.submit_claim(true, rule, uni, 100 * USDT), HeirloomError::BadStatus);
}

#[test]
fn claim_within_caps_pays_the_payee() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();

    let claim = env.submit_claim(true, rule, uni, 500 * USDT).unwrap();
    env.review_claim(claim, true).unwrap();
    env.approve_claim(claim, 0).unwrap();
    expect_err(env.approve_claim(claim, 0), HeirloomError::AlreadyApproved);
    env.execute_claim(rule, claim).unwrap();

    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 500 * USDT);
    assert_eq!(balance(&env.svm, &env.vault()), 4_500 * USDT);
    let r: Rule = fetch(&env.svm, &rule);
    assert_eq!(r.spent_total, 500 * USDT);
    assert_eq!(r.claim_count, 1);
    let c: Claim = fetch(&env.svm, &claim);
    assert_eq!(c.status, ClaimStatus::Paid);

    // Can't be paid twice.
    expect_err(env.execute_claim(rule, claim), HeirloomError::BadStatus);
}

#[test]
fn claim_over_per_claim_cap_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    expect_err(env.submit_claim(true, rule, uni, 601 * USDT), HeirloomError::ExceedsPerClaimCap);
}

#[test]
fn claim_over_lifetime_cap_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    env.pay_claim(rule, uni, 600 * USDT);
    expect_err(env.submit_claim(true, rule, uni, 500 * USDT), HeirloomError::ExceedsLifetimeCap);
    // Exactly up to the cap is fine.
    env.pay_claim(rule, uni, 400 * USDT);
    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 1_000 * USDT);
}

#[test]
fn lifetime_cap_rechecked_at_execution() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    // Two open claims that together exceed the lifetime cap.
    let c1 = env.submit_claim(true, rule, uni, 600 * USDT).unwrap();
    let c2 = env.submit_claim(true, rule, uni, 600 * USDT).unwrap();
    for c in [c1, c2] {
        env.review_claim(c, true).unwrap();
        env.approve_claim(c, 1).unwrap();
    }
    env.execute_claim(rule, c1).unwrap();
    expect_err(env.execute_claim(rule, c2), HeirloomError::ExceedsLifetimeCap);
}

#[test]
fn claim_to_wrong_payee_kind_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let landlord = env.landlord.pubkey();
    expect_err(env.submit_claim(true, rule, landlord, 100 * USDT), HeirloomError::WrongPayeeKind);
}

#[test]
fn claim_by_other_beneficiary_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    expect_err(env.submit_claim(false, rule, uni, 100 * USDT), HeirloomError::NotBeneficiary);
}

#[test]
fn claim_after_rule_expiry_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    warp(&mut env.svm, 366 * DAY);
    let uni = env.university.pubkey();
    expect_err(env.submit_claim(true, rule, uni, 100 * USDT), HeirloomError::RuleExpired);
}

#[test]
fn claim_with_insufficient_approvals_fails() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    let claim = env.submit_claim(true, rule, uni, 100 * USDT).unwrap();

    // Verifiers can't approve before the agent.
    expect_err(env.approve_claim(claim, 0), HeirloomError::AgentNotApproved);
    expect_err(env.execute_claim(rule, claim), HeirloomError::AgentNotApproved);

    env.review_claim(claim, true).unwrap();
    expect_err(env.execute_claim(rule, claim), HeirloomError::InsufficientApprovals);
    assert_eq!(balance(&env.svm, &env.vault()), 5_000 * USDT);
}

#[test]
fn agent_rejected_claim_cannot_be_paid() {
    let (mut env, rule) = claims_env();
    env.unlock();
    let uni = env.university.pubkey();
    let claim = env.submit_claim(true, rule, uni, 100 * USDT).unwrap();
    env.review_claim(claim, false).unwrap();
    let c: Claim = fetch(&env.svm, &claim);
    assert_eq!(c.status, ClaimStatus::Rejected);
    expect_err(env.approve_claim(claim, 0), HeirloomError::BadStatus);
    expect_err(env.execute_claim(rule, claim), HeirloomError::BadStatus);
}

// =================================================================== tests: asset sale

#[test]
fn offer_below_floor_rejected_and_best_offer_settles_atomically() {
    let mut s = Sale::new();
    let usdt = s.env.usdt_mint;
    let (b1, b2) = (s.env.buyer1.pubkey(), s.env.buyer2.pubkey());
    let executor = s.env.executor.pubkey();

    s.place_offer(1, 8_000 * USDT).unwrap();
    s.place_offer(2, 9_500 * USDT).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&b1, &usdt)), 12_000 * USDT);

    expect_err(s.accept_offer(1), HeirloomError::BelowFloor);

    s.accept_offer(2).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&executor, &usdt)), 9_500 * USDT);
    assert_eq!(balance(&s.env.svm, &ata(&b2, &s.nft_mint)), 1);
    assert_eq!(balance(&s.env.svm, &ata(&s.env.estate, &s.nft_mint)), 0);
    let a: Asset = fetch(&s.env.svm, &s.asset);
    assert_eq!(a.status, AssetStatus::Sold);
    let offer2 = offer_pda(&s.asset, &b2);
    assert!(is_closed(&s.env.svm, &offer2));
    assert!(is_closed(&s.env.svm, &ata(&offer2, &usdt)));

    // The losing buyer gets the full refund after the sale.
    s.withdraw_offer(1).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&b1, &usdt)), 20_000 * USDT);

    // Nothing more can be sold or offered.
    expect_err(s.place_offer(1, 9_999 * USDT), HeirloomError::BadStatus);
}

#[test]
fn hardship_approved_allows_hardship_floor_and_pays_hardship_beneficiary() {
    let mut s = Sale::new();
    let usdt = s.env.usdt_mint;
    let kid2 = s.env.kid2.pubkey();
    let b1 = s.env.buyer1.pubkey();

    s.place_offer(1, 7_500 * USDT).unwrap();
    expect_err(s.accept_offer(1), HeirloomError::BelowFloor);

    let h = s.submit_hardship().unwrap();
    expect_err(s.approve_hardship(h, 0), HeirloomError::AgentNotApproved);
    s.review_hardship(h, true).unwrap();
    s.approve_hardship(h, 0).unwrap();
    expect_err(s.approve_hardship(h, 0), HeirloomError::AlreadyApproved);
    // One approval is below the hardship quorum (2): still bound by the normal floor.
    expect_err(s.accept_offer(1), HeirloomError::BelowFloor);
    s.approve_hardship(h, 1).unwrap();

    s.accept_offer(1).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&kid2, &usdt)), 7_500 * USDT);
    assert_eq!(balance(&s.env.svm, &ata(&s.env.executor.pubkey(), &usdt)), 0);
    assert_eq!(balance(&s.env.svm, &ata(&b1, &s.nft_mint)), 1);
}

#[test]
fn offer_below_hardship_floor_rejected() {
    let mut s = Sale::new();
    s.approved_hardship();
    s.place_offer(1, 6_999 * USDT).unwrap();
    expect_err(s.accept_offer(1), HeirloomError::BelowHardshipFloor);
    let a: Asset = fetch(&s.env.svm, &s.asset);
    assert_eq!(a.status, AssetStatus::Listed);
}

#[test]
fn withdraw_offer_refunds_buyer() {
    let mut s = Sale::new();
    let usdt = s.env.usdt_mint;
    let b1 = s.env.buyer1.pubkey();
    let offer = offer_pda(&s.asset, &b1);

    s.place_offer(1, 9_000 * USDT).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&b1, &usdt)), 11_000 * USDT);
    assert_eq!(balance(&s.env.svm, &ata(&offer, &usdt)), 9_000 * USDT);

    s.withdraw_offer(1).unwrap();
    assert_eq!(balance(&s.env.svm, &ata(&b1, &usdt)), 20_000 * USDT);
    assert!(is_closed(&s.env.svm, &offer));
    assert!(is_closed(&s.env.svm, &ata(&offer, &usdt)));

    // The offer is gone, so it can't be accepted.
    assert!(s.accept_offer(1).is_err());
}

#[test]
fn offers_after_listing_end_rejected() {
    let mut s = Sale::new();
    warp(&mut s.env.svm, 3 * DAY);
    expect_err(s.place_offer(1, 9_500 * USDT), HeirloomError::ListingClosed);
}

// =================================================================== tests: living plans + scheduled payments

const MINUTE: i64 = 60;

#[test]
fn scheduled_payment_pays_when_due_and_stops_at_lifetime_cap() {
    let mut env = Env::configured();
    let (kid1, uni) = (env.kid1.pubkey(), env.university.pubkey());
    let valid_until = now(&env.svm) + 365 * DAY;
    let first_due = now(&env.svm) + MINUTE;
    // Living plan: 400 every minute to the university, 1,000 lifetime.
    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, true, 400 * USDT, MINUTE, first_due, Some(uni));
    send(&mut env.svm, i, &[&env.owner]).unwrap();
    let rule = rule_pda(&env.estate, 0);
    let r: Rule = fetch(&env.svm, &rule);
    assert_eq!((r.fixed_payee, r.next_due, r.interval_secs), (uni, first_due, MINUTE));

    // Estate is Active (owner alive) and the rule starts now.
    expect_err(env.execute_scheduled(rule), HeirloomError::NotDue);
    warp(&mut env.svm, MINUTE);
    env.execute_scheduled(rule).unwrap();
    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 400 * USDT);
    expect_err(env.execute_scheduled(rule), HeirloomError::NotDue);

    warp(&mut env.svm, MINUTE);
    env.execute_scheduled(rule).unwrap();
    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 800 * USDT);
    let r: Rule = fetch(&env.svm, &rule);
    assert_eq!(r.spent_total, 800 * USDT);
    assert_eq!(r.next_due, first_due + 2 * MINUTE);

    warp(&mut env.svm, MINUTE);
    expect_err(env.execute_scheduled(rule), HeirloomError::ExceedsLifetimeCap);
    assert_eq!(balance(&env.svm, &env.vault()), 4_200 * USDT);
}

#[test]
fn scheduled_payment_waits_for_unlock_unless_starts_now() {
    let mut env = Env::configured();
    let (kid1, uni) = (env.kid1.pubkey(), env.university.pubkey());
    let valid_until = now(&env.svm) + 365 * DAY;
    let first_due = now(&env.svm);
    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, false, 100 * USDT, MINUTE, first_due, Some(uni));
    send(&mut env.svm, i, &[&env.owner]).unwrap();
    let rule = rule_pda(&env.estate, 0);

    expect_err(env.execute_scheduled(rule), HeirloomError::BadStatus);
    env.unlock();
    env.execute_scheduled(rule).unwrap();
    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 100 * USDT);
}

#[test]
fn recurring_rule_needs_a_payee_of_the_allowed_kind() {
    let mut env = Env::configured();
    let (kid1, ll) = (env.kid1.pubkey(), env.landlord.pubkey());
    let valid_until = now(&env.svm) + 365 * DAY;
    let t = now(&env.svm);

    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, true, 100 * USDT, MINUTE, t, None);
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::PayeeRequired);

    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, true, 100 * USDT, MINUTE, t, Some(ll));
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::WrongPayeeKind);

    let i = env.add_rule_ix(0, kid1, PayeeKind::Landlord, 600 * USDT, 1_000 * USDT, valid_until, true, 100 * USDT, 0, t, Some(ll));
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::InvalidAmount);

    let i = env.add_rule_ix(0, kid1, PayeeKind::Landlord, 600 * USDT, 1_000 * USDT, valid_until, true, 700 * USDT, MINUTE, t, Some(ll));
    expect_err(send(&mut env.svm, i, &[&env.owner]), HeirloomError::ExceedsPerClaimCap);

    let i = env.add_rule_ix(0, kid1, PayeeKind::Landlord, 600 * USDT, 1_000 * USDT, valid_until, true, 100 * USDT, MINUTE, t, Some(ll));
    send(&mut env.svm, i, &[&env.owner]).unwrap();
}

#[test]
fn living_plan_claim_needs_owner_approval_while_active() {
    let mut env = Env::configured();
    let (kid1, uni) = (env.kid1.pubkey(), env.university.pubkey());
    let valid_until = now(&env.svm) + 365 * DAY;
    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, true, 0, 0, 0, None);
    send(&mut env.svm, i, &[&env.owner]).unwrap();
    let rule = rule_pda(&env.estate, 0);

    // Estate Active: a starts_now rule accepts claims.
    let claim = env.submit_claim(true, rule, uni, 300 * USDT).unwrap();
    expect_err(env.owner_approve_claim(rule, claim), HeirloomError::AgentNotApproved);
    env.review_claim(claim, true).unwrap();
    expect_err(env.execute_claim(rule, claim), HeirloomError::InsufficientApprovals);
    // Verifier approvals alone don't release money while the owner is alive.
    env.approve_claim(claim, 0).unwrap();
    expect_err(env.execute_claim(rule, claim), HeirloomError::InsufficientApprovals);

    env.owner_approve_claim(rule, claim).unwrap();
    expect_err(env.owner_approve_claim(rule, claim), HeirloomError::AlreadyApproved);
    env.execute_claim(rule, claim).unwrap();
    assert_eq!(balance(&env.svm, &ata(&uni, &env.usdt_mint)), 300 * USDT);
    let c: Claim = fetch(&env.svm, &claim);
    assert!(c.owner_approved);
    assert_eq!(c.status, ClaimStatus::Paid);
}

#[test]
fn owner_cannot_approve_after_unlock() {
    let mut env = Env::configured();
    let (kid1, uni) = (env.kid1.pubkey(), env.university.pubkey());
    let valid_until = now(&env.svm) + 365 * DAY;
    let i = env.add_rule_ix(0, kid1, PayeeKind::University, 600 * USDT, 1_000 * USDT, valid_until, true, 0, 0, 0, None);
    send(&mut env.svm, i, &[&env.owner]).unwrap();
    let rule = rule_pda(&env.estate, 0);
    env.unlock();
    let claim = env.submit_claim(true, rule, uni, 300 * USDT).unwrap();
    env.review_claim(claim, true).unwrap();
    expect_err(env.owner_approve_claim(rule, claim), HeirloomError::BadStatus);
    env.approve_claim(claim, 0).unwrap();
    env.execute_claim(rule, claim).unwrap();
}
