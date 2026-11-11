//! Heirloom: a programmable estate trust. USD₮ sits in a vault owned by the Estate PDA and
//! only moves under the rules below. Spec: docs/program-spec.md (source of truth).
#![allow(unexpected_cfgs)]
#![allow(clippy::too_many_arguments)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("b3PBVwkLnyx7eyLPNtc5J3Ds3os3cenqCVRHaCJM7FY");

#[program]
pub mod heirloom {
    use super::*;

    // ------------------------------------------------------------------ setup (owner)

    pub fn create_estate(
        ctx: Context<CreateEstate>,
        agent: Pubkey,
        verifiers: [Pubkey; 3],
        death_threshold: u8,
        claim_threshold: u8,
        hardship_threshold: u8,
        waiting_period_secs: i64,
    ) -> Result<()> {
        instructions::setup::create_estate_handler(
            ctx,
            agent,
            verifiers,
            death_threshold,
            claim_threshold,
            hardship_threshold,
            waiting_period_secs,
        )
    }

    pub fn set_will(ctx: Context<SetWill>, will_hash: [u8; 32], will_uri: String) -> Result<()> {
        instructions::setup::set_will_handler(ctx, will_hash, will_uri)
    }

    pub fn add_beneficiary(ctx: Context<AddBeneficiary>, label: String) -> Result<()> {
        instructions::setup::add_beneficiary_handler(ctx, label)
    }

    pub fn add_payee(ctx: Context<AddPayee>, kind: PayeeKind, name: String) -> Result<()> {
        instructions::setup::add_payee_handler(ctx, kind, name)
    }

    pub fn add_rule(
        ctx: Context<AddRule>,
        category: Category,
        allowed_payee_kind: PayeeKind,
        max_per_claim: u64,
        lifetime_cap: u64,
        valid_until: i64,
        starts_now: bool,
        recurring_amount: u64,
        interval_secs: i64,
        first_due: i64,
    ) -> Result<()> {
        instructions::setup::add_rule_handler(
            ctx,
            category,
            allowed_payee_kind,
            max_per_claim,
            lifetime_cap,
            valid_until,
            starts_now,
            recurring_amount,
            interval_secs,
            first_due,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::setup::deposit_handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::setup::withdraw_handler(ctx, amount)
    }

    pub fn heartbeat(ctx: Context<Heartbeat>) -> Result<()> {
        instructions::setup::heartbeat_handler(ctx)
    }

    pub fn register_asset(
        ctx: Context<RegisterAsset>,
        floor_price: u64,
        hardship_floor: u64,
        asking_price: u64,
        proceeds_to: Pubkey,
        doc_hash: [u8; 32],
    ) -> Result<()> {
        instructions::setup::register_asset_handler(
            ctx,
            floor_price,
            hardship_floor,
            asking_price,
            proceeds_to,
            doc_hash,
        )
    }

    // ------------------------------------------------------------------ death

    pub fn submit_death_claim(ctx: Context<SubmitDeathClaim>, cert_hash: [u8; 32]) -> Result<()> {
        instructions::death::submit_death_claim_handler(ctx, cert_hash)
    }

    pub fn review_death(ctx: Context<ReviewDeath>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
        instructions::death::review_death_handler(ctx, approve, report_hash)
    }

    pub fn attest_death(ctx: Context<AttestDeath>) -> Result<()> {
        instructions::death::attest_death_handler(ctx)
    }

    pub fn veto_death(ctx: Context<VetoDeath>) -> Result<()> {
        instructions::death::veto_death_handler(ctx)
    }

    pub fn finalize_unlock(ctx: Context<FinalizeUnlock>) -> Result<()> {
        instructions::death::finalize_unlock_handler(ctx)
    }

    // ------------------------------------------------------------------ claims

    pub fn submit_claim(ctx: Context<SubmitClaim>, amount: u64, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::claims::submit_claim_handler(ctx, amount, evidence_hash)
    }

    pub fn review_claim(ctx: Context<ReviewClaim>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
        instructions::claims::review_claim_handler(ctx, approve, report_hash)
    }

    pub fn approve_claim(ctx: Context<ApproveClaim>) -> Result<()> {
        instructions::claims::approve_claim_handler(ctx)
    }

    pub fn execute_claim(ctx: Context<ExecuteClaim>) -> Result<()> {
        instructions::claims::execute_claim_handler(ctx)
    }

    pub fn owner_approve_claim(ctx: Context<OwnerApproveClaim>) -> Result<()> {
        instructions::claims::owner_approve_claim_handler(ctx)
    }

    pub fn execute_scheduled(ctx: Context<ExecuteScheduled>) -> Result<()> {
        instructions::claims::execute_scheduled_handler(ctx)
    }

    // ------------------------------------------------------------------ asset sale

    pub fn list_asset(ctx: Context<ListAsset>, duration_secs: i64) -> Result<()> {
        instructions::sale::list_asset_handler(ctx, duration_secs)
    }

    pub fn place_offer(ctx: Context<PlaceOffer>, amount: u64) -> Result<()> {
        instructions::sale::place_offer_handler(ctx, amount)
    }

    pub fn withdraw_offer(ctx: Context<WithdrawOffer>) -> Result<()> {
        instructions::sale::withdraw_offer_handler(ctx)
    }

    pub fn submit_hardship(ctx: Context<SubmitHardship>, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::sale::submit_hardship_handler(ctx, evidence_hash)
    }

    pub fn review_hardship(ctx: Context<ReviewHardship>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
        instructions::sale::review_hardship_handler(ctx, approve, report_hash)
    }

    pub fn approve_hardship(ctx: Context<ApproveHardship>) -> Result<()> {
        instructions::sale::approve_hardship_handler(ctx)
    }

    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        instructions::sale::accept_offer_handler(ctx)
    }
}
