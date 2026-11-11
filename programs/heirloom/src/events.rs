use anchor_lang::prelude::*;

// Field lists are mirrored in docs/program-spec.md ("Events") and the IDL.

#[event]
pub struct EstateCreated {
    pub estate: Pubkey,
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub usdt_mint: Pubkey,
    pub ts: i64,
}

#[event]
pub struct WillSet {
    pub estate: Pubkey,
    pub will_hash: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct DeathClaimSubmitted {
    pub estate: Pubkey,
    pub submitted_by: Pubkey,
    pub cert_hash: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct DeathReviewed {
    pub estate: Pubkey,
    pub approved: bool,
    pub report_hash: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct DeathAttested {
    pub estate: Pubkey,
    pub verifier: Pubkey,
    /// Number of attestations so far.
    pub count: u8,
    /// True once the estate is DeathPending (threshold reached).
    pub pending: bool,
    pub ts: i64,
}

#[event]
pub struct DeathVetoed {
    pub estate: Pubkey,
    pub ts: i64,
}

#[event]
pub struct EstateUnlocked {
    pub estate: Pubkey,
    pub ts: i64,
}

#[event]
pub struct ClaimSubmitted {
    pub estate: Pubkey,
    pub rule: Pubkey,
    pub claim: Pubkey,
    pub beneficiary: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct ClaimReviewed {
    pub claim: Pubkey,
    pub approved: bool,
    pub report_hash: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct ClaimApproved {
    pub claim: Pubkey,
    pub verifier: Pubkey,
    pub count: u8,
    pub ts: i64,
}

#[event]
pub struct ClaimOwnerApproved {
    pub claim: Pubkey,
    pub owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct ScheduledPaid {
    pub estate: Pubkey,
    pub rule: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub next_due: i64,
    pub ts: i64,
}

#[event]
pub struct ClaimPaid {
    pub estate: Pubkey,
    pub rule: Pubkey,
    pub claim: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct AssetRegistered {
    pub estate: Pubkey,
    pub asset: Pubkey,
    pub nft_mint: Pubkey,
    pub floor_price: u64,
    pub hardship_floor: u64,
    pub asking_price: u64,
    pub ts: i64,
}

#[event]
pub struct AssetListed {
    pub asset: Pubkey,
    pub listing_ends: i64,
    pub ts: i64,
}

#[event]
pub struct OfferPlaced {
    pub asset: Pubkey,
    pub offer: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct OfferWithdrawn {
    pub asset: Pubkey,
    pub offer: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct HardshipSubmitted {
    pub asset: Pubkey,
    pub hardship: Pubkey,
    pub beneficiary: Pubkey,
    pub ts: i64,
}

#[event]
pub struct HardshipReviewed {
    pub hardship: Pubkey,
    pub approved: bool,
    pub report_hash: [u8; 32],
    pub ts: i64,
}

#[event]
pub struct HardshipApproved {
    pub asset: Pubkey,
    pub hardship: Pubkey,
    pub verifier: Pubkey,
    pub count: u8,
    /// True once the quorum is reached and the hardship floor applies.
    pub quorum_reached: bool,
    pub ts: i64,
}

#[event]
pub struct AssetSold {
    pub asset: Pubkey,
    pub buyer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub hardship: bool,
    pub ts: i64,
}
