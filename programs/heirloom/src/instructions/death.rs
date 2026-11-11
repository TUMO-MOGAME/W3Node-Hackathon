//! Death flow: beneficiary submits a certificate hash -> agent reviews -> verifiers attest
//! (death_threshold) -> waiting period (owner can veto) -> anyone finalises the unlock.
use anchor_lang::prelude::*;

use super::{count_bits, now};
use crate::errors::HeirloomError;
use crate::events::*;
use crate::state::*;

// ====================================================================== submit_death_claim

#[derive(Accounts)]
pub struct SubmitDeathClaim<'info> {
    pub beneficiary: Signer<'info>,

    #[account(mut)]
    pub estate: Account<'info, Estate>,

    #[account(
        seeds = [BENEFICIARY_SEED, estate.key().as_ref(), beneficiary.key().as_ref()],
        bump = beneficiary_account.bump
    )]
    pub beneficiary_account: Account<'info, Beneficiary>,
}

pub fn submit_death_claim_handler(ctx: Context<SubmitDeathClaim>, cert_hash: [u8; 32]) -> Result<()> {
    require!(ctx.accounts.beneficiary_account.active, HeirloomError::NotBeneficiary);
    require!(cert_hash != [0u8; 32], HeirloomError::NoDeathClaim);

    let submitted_by = ctx.accounts.beneficiary.key();
    let estate = &mut ctx.accounts.estate;
    require!(estate.status == EstateStatus::Active, HeirloomError::BadStatus);
    // One open death claim at a time, so a second submission can't reset attestations.
    require!(estate.death_cert_hash == [0u8; 32], HeirloomError::BadStatus);

    estate.death_cert_hash = cert_hash;
    estate.death_submitted_by = submitted_by;
    estate.death_verdict = Verdict::Pending;
    estate.death_attestations = 0;
    estate.death_pending_since = 0;

    emit!(DeathClaimSubmitted {
        estate: estate.key(),
        submitted_by,
        cert_hash,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== review_death

#[derive(Accounts)]
pub struct ReviewDeath<'info> {
    pub agent: Signer<'info>,

    #[account(mut, has_one = agent @ HeirloomError::NotAgent)]
    pub estate: Account<'info, Estate>,
}

pub fn review_death_handler(ctx: Context<ReviewDeath>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
    let estate = &mut ctx.accounts.estate;
    require!(estate.death_cert_hash != [0u8; 32], HeirloomError::NoDeathClaim);
    require!(estate.status == EstateStatus::Active, HeirloomError::BadStatus);
    require!(estate.death_verdict == Verdict::Pending, HeirloomError::BadStatus);

    if approve {
        estate.death_verdict = Verdict::Approved;
    } else {
        estate.clear_death_claim();
    }

    emit!(DeathReviewed {
        estate: estate.key(),
        approved: approve,
        report_hash,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== attest_death

#[derive(Accounts)]
pub struct AttestDeath<'info> {
    pub verifier: Signer<'info>,

    #[account(mut)]
    pub estate: Account<'info, Estate>,
}

pub fn attest_death_handler(ctx: Context<AttestDeath>) -> Result<()> {
    let verifier = ctx.accounts.verifier.key();
    let estate = &mut ctx.accounts.estate;
    let idx = estate
        .verifier_index(&verifier)
        .ok_or(HeirloomError::NotVerifier)?;

    require!(estate.death_cert_hash != [0u8; 32], HeirloomError::NoDeathClaim);
    require!(
        estate.status == EstateStatus::Active || estate.status == EstateStatus::DeathPending,
        HeirloomError::BadStatus
    );
    require!(estate.death_verdict == Verdict::Approved, HeirloomError::AgentNotApproved);

    let bit = 1u8 << idx;
    require!(estate.death_attestations & bit == 0, HeirloomError::AlreadyApproved);
    estate.death_attestations |= bit;

    let ts = now()?;
    let count = count_bits(estate.death_attestations);
    // Only the attestation that reaches the threshold starts the timer; later ones don't reset it.
    if estate.status == EstateStatus::Active && count >= estate.death_threshold {
        estate.status = EstateStatus::DeathPending;
        estate.death_pending_since = ts;
    }

    emit!(DeathAttested {
        estate: estate.key(),
        verifier,
        count,
        pending: estate.status == EstateStatus::DeathPending,
        ts,
    });
    Ok(())
}

// ====================================================================== veto_death

#[derive(Accounts)]
pub struct VetoDeath<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [ESTATE_SEED, owner.key().as_ref()],
        bump = estate.bump,
        has_one = owner @ HeirloomError::NotOwner
    )]
    pub estate: Account<'info, Estate>,
}

pub fn veto_death_handler(ctx: Context<VetoDeath>) -> Result<()> {
    let estate = &mut ctx.accounts.estate;
    require!(
        estate.status == EstateStatus::Active || estate.status == EstateStatus::DeathPending,
        HeirloomError::BadStatus
    );

    let ts = now()?;
    estate.clear_death_claim();
    estate.status = EstateStatus::Active;
    estate.last_heartbeat = ts;

    emit!(DeathVetoed {
        estate: estate.key(),
        ts,
    });
    Ok(())
}

// ====================================================================== finalize_unlock

#[derive(Accounts)]
pub struct FinalizeUnlock<'info> {
    #[account(mut)]
    pub estate: Account<'info, Estate>,
}

pub fn finalize_unlock_handler(ctx: Context<FinalizeUnlock>) -> Result<()> {
    let estate = &mut ctx.accounts.estate;
    require!(estate.status == EstateStatus::DeathPending, HeirloomError::BadStatus);

    let ts = now()?;
    let unlock_at = estate
        .death_pending_since
        .checked_add(estate.waiting_period_secs)
        .ok_or(HeirloomError::MathOverflow)?;
    require!(ts >= unlock_at, HeirloomError::WaitingPeriodNotOver);

    estate.status = EstateStatus::Unlocked;

    emit!(EstateUnlocked {
        estate: estate.key(),
        ts,
    });
    Ok(())
}
