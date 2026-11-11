use anchor_lang::prelude::*;

/// Codes start at 6000 in this order. Keep in step with docs/program-spec.md and the IDL.
#[error_code]
pub enum HeirloomError {
    #[msg("Signer is not the estate owner")]
    NotOwner,
    #[msg("Signer is not the estate agent")]
    NotAgent,
    #[msg("Signer is not one of the estate verifiers")]
    NotVerifier,
    #[msg("Signer is not an active beneficiary of this estate or rule")]
    NotBeneficiary,
    #[msg("This verifier has already approved")]
    AlreadyApproved,
    #[msg("Thresholds must be between 1 and 3 and the waiting period must not be negative")]
    InvalidThreshold,
    #[msg("Verifiers must be distinct and must not be the owner")]
    DuplicateVerifier,
    #[msg("The account is not in the right status for this action")]
    BadStatus,
    #[msg("There is no death claim to act on")]
    NoDeathClaim,
    #[msg("The agent has not approved this item")]
    AgentNotApproved,
    #[msg("The waiting period is not over yet")]
    WaitingPeriodNotOver,
    #[msg("The payee is not of the kind this rule allows")]
    WrongPayeeKind,
    #[msg("Amount exceeds the per-claim cap")]
    ExceedsPerClaimCap,
    #[msg("Amount exceeds the rule's lifetime cap")]
    ExceedsLifetimeCap,
    #[msg("The rule has expired")]
    RuleExpired,
    #[msg("Not enough verifier approvals")]
    InsufficientApprovals,
    #[msg("Offer is below the floor price")]
    BelowFloor,
    #[msg("Offer is below the hardship floor")]
    BelowHardshipFloor,
    #[msg("The listing is closed")]
    ListingClosed,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("The NFT mint must have 0 decimals and a supply of 1")]
    InvalidNft,
    #[msg("String is too long")]
    StringTooLong,
    #[msg("Token account or mint does not match the estate's USDT mint")]
    WrongMint,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("A recurring rule needs a payee account")]
    PayeeRequired,
    #[msg("The scheduled payment is not due yet")]
    NotDue,
}
