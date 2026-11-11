//! Claims: after unlock, money leaves the vault only to an approved payee, within a rule's caps,
//! after the agent's review and claim_threshold verifier approvals.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::{count_bits, now, transfer_checked_cpi};
use crate::errors::HeirloomError;
use crate::events::*;
use crate::state::*;

/// Payments under `rule` may move: Unlocked always; Active only for a living plan (starts_now).
fn rule_open_for(estate: &Estate, rule: &Rule) -> bool {
    estate.status == EstateStatus::Unlocked
        || (estate.status == EstateStatus::Active && rule.starts_now)
}

// ====================================================================== submit_claim

#[derive(Accounts)]
pub struct SubmitClaim<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(
        seeds = [BENEFICIARY_SEED, estate.key().as_ref(), beneficiary.key().as_ref()],
        bump = beneficiary_account.bump
    )]
    pub beneficiary_account: Box<Account<'info, Beneficiary>>,

    #[account(mut, has_one = estate)]
    pub rule: Box<Account<'info, Rule>>,

    /// The Payee PDA the money will go to.
    #[account(has_one = estate)]
    pub payee: Box<Account<'info, Payee>>,

    #[account(
        init,
        payer = beneficiary,
        space = 8 + Claim::INIT_SPACE,
        seeds = [CLAIM_SEED, rule.key().as_ref(), &rule.claim_count.to_le_bytes()],
        bump
    )]
    pub claim: Box<Account<'info, Claim>>,

    pub system_program: Program<'info, System>,
}

pub fn submit_claim_handler(ctx: Context<SubmitClaim>, amount: u64, evidence_hash: [u8; 32]) -> Result<()> {
    let signer = ctx.accounts.beneficiary.key();
    require!(ctx.accounts.beneficiary_account.active, HeirloomError::NotBeneficiary);
    let rule = &ctx.accounts.rule;
    require!(
        rule_open_for(&ctx.accounts.estate, rule),
        HeirloomError::BadStatus
    );

    require_keys_eq!(rule.beneficiary, signer, HeirloomError::NotBeneficiary);
    require!(amount > 0, HeirloomError::InvalidAmount);
    require!(
        ctx.accounts.payee.kind == rule.allowed_payee_kind,
        HeirloomError::WrongPayeeKind
    );
    require!(amount <= rule.max_per_claim, HeirloomError::ExceedsPerClaimCap);
    let new_total = rule
        .spent_total
        .checked_add(amount)
        .ok_or(HeirloomError::MathOverflow)?;
    require!(new_total <= rule.lifetime_cap, HeirloomError::ExceedsLifetimeCap);

    let ts = now()?;
    require!(ts <= rule.valid_until, HeirloomError::RuleExpired);

    let id = rule.claim_count;
    let estate = ctx.accounts.estate.key();
    let rule_key = rule.key();
    let payee = ctx.accounts.payee.wallet;
    let bump = ctx.bumps.claim;

    ctx.accounts.claim.set_inner(Claim {
        estate,
        rule: rule_key,
        id,
        beneficiary: signer,
        payee,
        amount,
        evidence_hash,
        agent_verdict: Verdict::Pending,
        agent_report_hash: [0u8; 32],
        approvals: 0,
        status: ClaimStatus::Open,
        created_at: ts,
        owner_approved: false,
        bump,
    });
    ctx.accounts.rule.claim_count = id.checked_add(1).ok_or(HeirloomError::MathOverflow)?;

    emit!(ClaimSubmitted {
        estate,
        rule: rule_key,
        claim: ctx.accounts.claim.key(),
        beneficiary: signer,
        payee,
        amount,
        ts,
    });
    Ok(())
}

// ====================================================================== review_claim

#[derive(Accounts)]
pub struct ReviewClaim<'info> {
    pub agent: Signer<'info>,

    #[account(has_one = agent @ HeirloomError::NotAgent)]
    pub estate: Account<'info, Estate>,

    #[account(mut, has_one = estate)]
    pub claim: Account<'info, Claim>,
}

pub fn review_claim_handler(ctx: Context<ReviewClaim>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
    let claim = &mut ctx.accounts.claim;
    require!(
        claim.status == ClaimStatus::Open && claim.agent_verdict == Verdict::Pending,
        HeirloomError::BadStatus
    );

    claim.agent_report_hash = report_hash;
    if approve {
        claim.agent_verdict = Verdict::Approved;
    } else {
        claim.agent_verdict = Verdict::Rejected;
        claim.status = ClaimStatus::Rejected;
    }

    emit!(ClaimReviewed {
        claim: claim.key(),
        approved: approve,
        report_hash,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== approve_claim

#[derive(Accounts)]
pub struct ApproveClaim<'info> {
    pub verifier: Signer<'info>,

    pub estate: Account<'info, Estate>,

    #[account(mut, has_one = estate)]
    pub claim: Account<'info, Claim>,
}

pub fn approve_claim_handler(ctx: Context<ApproveClaim>) -> Result<()> {
    let verifier = ctx.accounts.verifier.key();
    let idx = ctx
        .accounts
        .estate
        .verifier_index(&verifier)
        .ok_or(HeirloomError::NotVerifier)?;

    let claim = &mut ctx.accounts.claim;
    require!(claim.status == ClaimStatus::Open, HeirloomError::BadStatus);
    require!(claim.agent_verdict == Verdict::Approved, HeirloomError::AgentNotApproved);

    let bit = 1u8 << idx;
    require!(claim.approvals & bit == 0, HeirloomError::AlreadyApproved);
    claim.approvals |= bit;

    emit!(ClaimApproved {
        claim: claim.key(),
        verifier,
        count: count_bits(claim.approvals),
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== execute_claim

#[derive(Accounts)]
pub struct ExecuteClaim<'info> {
    /// Anyone; pays the payee ATA rent if it doesn't exist yet.
    #[account(mut)]
    pub payer: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(mut, has_one = estate)]
    pub rule: Box<Account<'info, Rule>>,

    #[account(mut, has_one = estate, has_one = rule)]
    pub claim: Box<Account<'info, Claim>>,

    /// CHECK: must equal claim.payee (the payee's wallet).
    #[account(address = claim.payee)]
    pub payee_wallet: UncheckedAccount<'info>,

    #[account(address = estate.usdt_mint @ HeirloomError::WrongMint)]
    pub usdt_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = estate,
        associated_token::token_program = token_program
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdt_mint,
        associated_token::authority = payee_wallet,
        associated_token::token_program = token_program
    )]
    pub payee_usdt: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn execute_claim_handler(ctx: Context<ExecuteClaim>) -> Result<()> {
    let estate = &ctx.accounts.estate;
    let rule = &ctx.accounts.rule;
    let claim = &ctx.accounts.claim;

    require!(rule_open_for(estate, rule), HeirloomError::BadStatus);
    require!(claim.status == ClaimStatus::Open, HeirloomError::BadStatus);
    require!(claim.agent_verdict == Verdict::Approved, HeirloomError::AgentNotApproved);
    // While the owner is alive (Active) only the owner can approve; after unlock the owner's
    // earlier approval or the verifier quorum counts.
    let approved = if estate.status == EstateStatus::Active {
        claim.owner_approved
    } else {
        claim.owner_approved || count_bits(claim.approvals) >= estate.claim_threshold
    };
    require!(approved, HeirloomError::InsufficientApprovals);

    // Re-check: other claims on this rule may have been paid since this one was submitted.
    let amount = claim.amount;
    let new_total = rule
        .spent_total
        .checked_add(amount)
        .ok_or(HeirloomError::MathOverflow)?;
    require!(new_total <= rule.lifetime_cap, HeirloomError::ExceedsLifetimeCap);
    let ts = now()?;
    require!(ts <= rule.valid_until, HeirloomError::RuleExpired);

    let owner = estate.owner;
    let bump = [estate.bump];
    let seeds: &[&[u8]] = &[ESTATE_SEED, owner.as_ref(), &bump];

    transfer_checked_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.usdt_mint.to_account_info(),
        ctx.accounts.payee_usdt.to_account_info(),
        ctx.accounts.estate.to_account_info(),
        amount,
        ctx.accounts.usdt_mint.decimals,
        &[seeds],
    )?;

    let estate_key = ctx.accounts.estate.key();
    let rule_key = ctx.accounts.rule.key();
    let claim_key = ctx.accounts.claim.key();
    let payee = ctx.accounts.claim.payee;

    ctx.accounts.rule.spent_total = new_total;
    ctx.accounts.claim.status = ClaimStatus::Paid;

    emit!(ClaimPaid {
        estate: estate_key,
        rule: rule_key,
        claim: claim_key,
        payee,
        amount,
        ts,
    });
    Ok(())
}

// ====================================================================== owner_approve_claim

#[derive(Accounts)]
pub struct OwnerApproveClaim<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [ESTATE_SEED, owner.key().as_ref()],
        bump = estate.bump,
        has_one = owner @ HeirloomError::NotOwner
    )]
    pub estate: Account<'info, Estate>,

    #[account(has_one = estate)]
    pub rule: Account<'info, Rule>,

    #[account(mut, has_one = estate, has_one = rule)]
    pub claim: Account<'info, Claim>,
}

/// Living plans: while alive, the owner approves claims on `starts_now` rules himself.
pub fn owner_approve_claim_handler(ctx: Context<OwnerApproveClaim>) -> Result<()> {
    require!(
        ctx.accounts.estate.status == EstateStatus::Active,
        HeirloomError::BadStatus
    );
    require!(ctx.accounts.rule.starts_now, HeirloomError::BadStatus);

    let claim = &mut ctx.accounts.claim;
    require!(claim.status == ClaimStatus::Open, HeirloomError::BadStatus);
    require!(claim.agent_verdict == Verdict::Approved, HeirloomError::AgentNotApproved);
    require!(!claim.owner_approved, HeirloomError::AlreadyApproved);
    claim.owner_approved = true;

    emit!(ClaimOwnerApproved {
        claim: claim.key(),
        owner: ctx.accounts.owner.key(),
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== execute_scheduled

#[derive(Accounts)]
pub struct ExecuteScheduled<'info> {
    /// Anyone (a keeper/cron); pays the payee ATA rent if it doesn't exist yet.
    #[account(mut)]
    pub payer: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(mut, has_one = estate)]
    pub rule: Box<Account<'info, Rule>>,

    /// CHECK: must equal rule.fixed_payee.
    #[account(address = rule.fixed_payee)]
    pub payee_wallet: UncheckedAccount<'info>,

    #[account(address = estate.usdt_mint @ HeirloomError::WrongMint)]
    pub usdt_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = estate,
        associated_token::token_program = token_program
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdt_mint,
        associated_token::authority = payee_wallet,
        associated_token::token_program = token_program
    )]
    pub payee_usdt: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Pays one instalment of a recurring rule to its fixed payee once it is due.
pub fn execute_scheduled_handler(ctx: Context<ExecuteScheduled>) -> Result<()> {
    let estate = &ctx.accounts.estate;
    let rule = &ctx.accounts.rule;

    require!(rule.recurring_amount > 0, HeirloomError::BadStatus);
    require!(rule_open_for(estate, rule), HeirloomError::BadStatus);
    let ts = now()?;
    require!(ts >= rule.next_due, HeirloomError::NotDue);
    require!(ts <= rule.valid_until, HeirloomError::RuleExpired);

    let amount = rule.recurring_amount;
    let new_total = rule
        .spent_total
        .checked_add(amount)
        .ok_or(HeirloomError::MathOverflow)?;
    require!(new_total <= rule.lifetime_cap, HeirloomError::ExceedsLifetimeCap);
    let next_due = rule
        .next_due
        .checked_add(rule.interval_secs)
        .ok_or(HeirloomError::MathOverflow)?;

    let owner = estate.owner;
    let bump = [estate.bump];
    let seeds: &[&[u8]] = &[ESTATE_SEED, owner.as_ref(), &bump];

    transfer_checked_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.usdt_mint.to_account_info(),
        ctx.accounts.payee_usdt.to_account_info(),
        ctx.accounts.estate.to_account_info(),
        amount,
        ctx.accounts.usdt_mint.decimals,
        &[seeds],
    )?;

    let estate_key = ctx.accounts.estate.key();
    let rule_key = ctx.accounts.rule.key();
    let payee = ctx.accounts.payee_wallet.key();
    let rule = &mut ctx.accounts.rule;
    rule.spent_total = new_total;
    rule.next_due = next_due;

    emit!(ScheduledPaid {
        estate: estate_key,
        rule: rule_key,
        payee,
        amount,
        next_due,
        ts,
    });
    Ok(())
}
