//! Asset sale: the estate sells the car's digital-title NFT. Offers escrow USD₮; the agent can
//! accept only >= floor_price, or >= hardship_floor once a hardship request reached quorum.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::{close_token_account_cpi, count_bits, now, transfer_checked_cpi};
use crate::errors::HeirloomError;
use crate::events::*;
use crate::state::*;

// ====================================================================== list_asset

#[derive(Accounts)]
pub struct ListAsset<'info> {
    /// The agent or one of the verifiers.
    pub authority: Signer<'info>,

    pub estate: Account<'info, Estate>,

    #[account(mut, has_one = estate)]
    pub asset: Account<'info, Asset>,
}

pub fn list_asset_handler(ctx: Context<ListAsset>, duration_secs: i64) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let estate = &ctx.accounts.estate;
    require!(
        authority == estate.agent || estate.verifier_index(&authority).is_some(),
        HeirloomError::NotAgent
    );
    require!(estate.status == EstateStatus::Unlocked, HeirloomError::BadStatus);
    require!(duration_secs > 0, HeirloomError::InvalidAmount);

    let asset = &mut ctx.accounts.asset;
    require!(asset.status == AssetStatus::Held, HeirloomError::BadStatus);

    let ts = now()?;
    asset.listing_ends = ts
        .checked_add(duration_secs)
        .ok_or(HeirloomError::MathOverflow)?;
    asset.status = AssetStatus::Listed;

    emit!(AssetListed {
        asset: asset.key(),
        listing_ends: asset.listing_ends,
        ts,
    });
    Ok(())
}

// ====================================================================== place_offer

#[derive(Accounts)]
pub struct PlaceOffer<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(has_one = estate)]
    pub asset: Box<Account<'info, Asset>>,

    #[account(address = estate.usdt_mint @ HeirloomError::WrongMint)]
    pub usdt_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = buyer_usdt.mint == estate.usdt_mint @ HeirloomError::WrongMint,
        constraint = buyer_usdt.owner == buyer.key()
    )]
    pub buyer_usdt: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, asset.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub offer: Box<Account<'info, Offer>>,

    /// Offer escrow = ATA(usdt_mint, offer). init_if_needed so a pre-created ATA can't block offers.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = usdt_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub offer_escrow: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn place_offer_handler(ctx: Context<PlaceOffer>, amount: u64) -> Result<()> {
    let asset = &ctx.accounts.asset;
    require!(asset.status == AssetStatus::Listed, HeirloomError::BadStatus);
    let ts = now()?;
    require!(ts < asset.listing_ends, HeirloomError::ListingClosed);
    require!(amount > 0, HeirloomError::InvalidAmount);

    transfer_checked_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.buyer_usdt.to_account_info(),
        ctx.accounts.usdt_mint.to_account_info(),
        ctx.accounts.offer_escrow.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        amount,
        ctx.accounts.usdt_mint.decimals,
        &[],
    )?;

    let asset_key = ctx.accounts.asset.key();
    let buyer = ctx.accounts.buyer.key();
    let bump = ctx.bumps.offer;
    ctx.accounts.offer.set_inner(Offer {
        asset: asset_key,
        buyer,
        amount,
        created_at: ts,
        bump,
    });

    emit!(OfferPlaced {
        asset: asset_key,
        offer: ctx.accounts.offer.key(),
        buyer,
        amount,
        ts,
    });
    Ok(())
}

// ====================================================================== withdraw_offer

#[derive(Accounts)]
pub struct WithdrawOffer<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(has_one = estate)]
    pub asset: Box<Account<'info, Asset>>,

    #[account(address = estate.usdt_mint @ HeirloomError::WrongMint)]
    pub usdt_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = buyer_usdt.mint == estate.usdt_mint @ HeirloomError::WrongMint,
        constraint = buyer_usdt.owner == buyer.key()
    )]
    pub buyer_usdt: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [OFFER_SEED, asset.key().as_ref(), buyer.key().as_ref()],
        bump = offer.bump,
        has_one = asset,
        has_one = buyer,
        close = buyer
    )]
    pub offer: Box<Account<'info, Offer>>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub offer_escrow: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw_offer_handler(ctx: Context<WithdrawOffer>) -> Result<()> {
    let asset_key = ctx.accounts.asset.key();
    let buyer = ctx.accounts.buyer.key();
    let offer_key = ctx.accounts.offer.key();
    let amount = ctx.accounts.offer.amount;
    // Return everything in escrow (so the close can't fail on a stray deposit).
    let escrow_balance = ctx.accounts.offer_escrow.amount;

    let bump = [ctx.accounts.offer.bump];
    let seeds: &[&[u8]] = &[OFFER_SEED, asset_key.as_ref(), buyer.as_ref(), &bump];

    if escrow_balance > 0 {
        transfer_checked_cpi(
            ctx.accounts.token_program.key(),
            ctx.accounts.offer_escrow.to_account_info(),
            ctx.accounts.usdt_mint.to_account_info(),
            ctx.accounts.buyer_usdt.to_account_info(),
            ctx.accounts.offer.to_account_info(),
            escrow_balance,
            ctx.accounts.usdt_mint.decimals,
            &[seeds],
        )?;
    }
    close_token_account_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.offer_escrow.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        ctx.accounts.offer.to_account_info(),
        &[seeds],
    )?;
    // The Offer account itself is closed to the buyer by `close = buyer`.

    emit!(OfferWithdrawn {
        asset: asset_key,
        offer: offer_key,
        buyer,
        amount,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== submit_hardship

#[derive(Accounts)]
pub struct SubmitHardship<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    pub estate: Box<Account<'info, Estate>>,

    #[account(
        seeds = [BENEFICIARY_SEED, estate.key().as_ref(), beneficiary.key().as_ref()],
        bump = beneficiary_account.bump
    )]
    pub beneficiary_account: Box<Account<'info, Beneficiary>>,

    #[account(has_one = estate)]
    pub asset: Box<Account<'info, Asset>>,

    #[account(
        init,
        payer = beneficiary,
        space = 8 + Hardship::INIT_SPACE,
        seeds = [HARDSHIP_SEED, asset.key().as_ref(), beneficiary.key().as_ref()],
        bump
    )]
    pub hardship: Box<Account<'info, Hardship>>,

    pub system_program: Program<'info, System>,
}

pub fn submit_hardship_handler(ctx: Context<SubmitHardship>, evidence_hash: [u8; 32]) -> Result<()> {
    require!(ctx.accounts.beneficiary_account.active, HeirloomError::NotBeneficiary);
    require!(
        ctx.accounts.estate.status == EstateStatus::Unlocked,
        HeirloomError::BadStatus
    );
    require!(
        ctx.accounts.asset.status != AssetStatus::Sold,
        HeirloomError::BadStatus
    );

    let asset = ctx.accounts.asset.key();
    let beneficiary = ctx.accounts.beneficiary.key();
    let bump = ctx.bumps.hardship;
    ctx.accounts.hardship.set_inner(Hardship {
        asset,
        beneficiary,
        evidence_hash,
        agent_verdict: Verdict::Pending,
        agent_report_hash: [0u8; 32],
        approvals: 0,
        status: HardshipStatus::Open,
        bump,
    });

    emit!(HardshipSubmitted {
        asset,
        hardship: ctx.accounts.hardship.key(),
        beneficiary,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== review_hardship

#[derive(Accounts)]
pub struct ReviewHardship<'info> {
    pub agent: Signer<'info>,

    #[account(has_one = agent @ HeirloomError::NotAgent)]
    pub estate: Account<'info, Estate>,

    #[account(has_one = estate)]
    pub asset: Account<'info, Asset>,

    #[account(mut, has_one = asset)]
    pub hardship: Account<'info, Hardship>,
}

pub fn review_hardship_handler(ctx: Context<ReviewHardship>, approve: bool, report_hash: [u8; 32]) -> Result<()> {
    let hardship = &mut ctx.accounts.hardship;
    require!(
        hardship.status == HardshipStatus::Open && hardship.agent_verdict == Verdict::Pending,
        HeirloomError::BadStatus
    );

    hardship.agent_report_hash = report_hash;
    if approve {
        hardship.agent_verdict = Verdict::Approved;
    } else {
        hardship.agent_verdict = Verdict::Rejected;
        hardship.status = HardshipStatus::Rejected;
    }

    emit!(HardshipReviewed {
        hardship: hardship.key(),
        approved: approve,
        report_hash,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== approve_hardship

#[derive(Accounts)]
pub struct ApproveHardship<'info> {
    pub verifier: Signer<'info>,

    pub estate: Account<'info, Estate>,

    #[account(mut, has_one = estate)]
    pub asset: Account<'info, Asset>,

    #[account(mut, has_one = asset)]
    pub hardship: Account<'info, Hardship>,
}

pub fn approve_hardship_handler(ctx: Context<ApproveHardship>) -> Result<()> {
    let verifier = ctx.accounts.verifier.key();
    let estate = &ctx.accounts.estate;
    let idx = estate
        .verifier_index(&verifier)
        .ok_or(HeirloomError::NotVerifier)?;
    let threshold = estate.hardship_threshold;

    let asset = &mut ctx.accounts.asset;
    let hardship = &mut ctx.accounts.hardship;
    require!(asset.status != AssetStatus::Sold, HeirloomError::BadStatus);
    require!(hardship.status == HardshipStatus::Open, HeirloomError::BadStatus);
    require!(hardship.agent_verdict == Verdict::Approved, HeirloomError::AgentNotApproved);

    let bit = 1u8 << idx;
    require!(hardship.approvals & bit == 0, HeirloomError::AlreadyApproved);
    hardship.approvals |= bit;

    let count = count_bits(hardship.approvals);
    let quorum_reached = count >= threshold;
    if quorum_reached {
        hardship.status = HardshipStatus::Approved;
        asset.hardship_beneficiary = Some(hardship.beneficiary);
    }

    emit!(HardshipApproved {
        asset: asset.key(),
        hardship: hardship.key(),
        verifier,
        count,
        quorum_reached,
        ts: now()?,
    });
    Ok(())
}

// ====================================================================== accept_offer

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    /// The agent; pays rent for the recipient's and buyer's ATAs if missing.
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(has_one = agent @ HeirloomError::NotAgent)]
    pub estate: Box<Account<'info, Estate>>,

    #[account(mut, has_one = estate)]
    pub asset: Box<Account<'info, Asset>>,

    #[account(mut, has_one = asset, has_one = buyer, close = buyer)]
    pub offer: Box<Account<'info, Offer>>,

    /// CHECK: equals offer.buyer (has_one); receives the NFT and the closed accounts' rent.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,

    /// CHECK: must be asset.hardship_beneficiary if set, otherwise asset.proceeds_to.
    #[account(constraint = recipient.key() == asset.hardship_beneficiary.unwrap_or(asset.proceeds_to))]
    pub recipient: UncheckedAccount<'info>,

    #[account(address = estate.usdt_mint @ HeirloomError::WrongMint)]
    pub usdt_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub offer_escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = agent,
        associated_token::mint = usdt_mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_usdt: Box<Account<'info, TokenAccount>>,

    #[account(address = asset.nft_mint @ HeirloomError::InvalidNft)]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = estate,
        associated_token::token_program = token_program
    )]
    pub nft_escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = agent,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program
    )]
    pub buyer_nft: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn accept_offer_handler(ctx: Context<AcceptOffer>) -> Result<()> {
    let asset = &ctx.accounts.asset;
    require!(asset.status == AssetStatus::Listed, HeirloomError::BadStatus);

    let amount = ctx.accounts.offer.amount;
    let hardship = asset.hardship_beneficiary.is_some();
    if hardship {
        require!(amount >= asset.hardship_floor, HeirloomError::BelowHardshipFloor);
    } else {
        require!(amount >= asset.floor_price, HeirloomError::BelowFloor);
    }

    let asset_key = asset.key();
    let buyer = ctx.accounts.buyer.key();
    let recipient = ctx.accounts.recipient.key();
    // Everything in escrow goes to the recipient (>= offer.amount), so the close can't fail.
    let escrow_balance = ctx.accounts.offer_escrow.amount;

    // 1. USD₮: offer escrow -> recipient, signed by the Offer PDA; then close the escrow.
    let offer_bump = [ctx.accounts.offer.bump];
    let offer_seeds: &[&[u8]] = &[OFFER_SEED, asset_key.as_ref(), buyer.as_ref(), &offer_bump];
    transfer_checked_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.offer_escrow.to_account_info(),
        ctx.accounts.usdt_mint.to_account_info(),
        ctx.accounts.recipient_usdt.to_account_info(),
        ctx.accounts.offer.to_account_info(),
        escrow_balance,
        ctx.accounts.usdt_mint.decimals,
        &[offer_seeds],
    )?;
    close_token_account_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.offer_escrow.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        ctx.accounts.offer.to_account_info(),
        &[offer_seeds],
    )?;

    // 2. Title NFT: estate escrow -> buyer, signed by the Estate PDA.
    let owner = ctx.accounts.estate.owner;
    let estate_bump = [ctx.accounts.estate.bump];
    let estate_seeds: &[&[u8]] = &[ESTATE_SEED, owner.as_ref(), &estate_bump];
    transfer_checked_cpi(
        ctx.accounts.token_program.key(),
        ctx.accounts.nft_escrow.to_account_info(),
        ctx.accounts.nft_mint.to_account_info(),
        ctx.accounts.buyer_nft.to_account_info(),
        ctx.accounts.estate.to_account_info(),
        1,
        0,
        &[estate_seeds],
    )?;

    ctx.accounts.asset.status = AssetStatus::Sold;

    emit!(AssetSold {
        asset: asset_key,
        buyer,
        recipient,
        amount,
        hardship,
        ts: now()?,
    });
    // The Offer account is closed to the buyer by `close = buyer`.
    Ok(())
}
