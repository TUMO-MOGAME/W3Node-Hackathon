use anchor_lang::prelude::*;

pub const ESTATE_SEED: &[u8] = b"estate";
pub const BENEFICIARY_SEED: &[u8] = b"beneficiary";
pub const PAYEE_SEED: &[u8] = b"payee";
pub const RULE_SEED: &[u8] = b"rule";
pub const CLAIM_SEED: &[u8] = b"claim";
pub const ASSET_SEED: &[u8] = b"asset";
pub const OFFER_SEED: &[u8] = b"offer";
pub const HARDSHIP_SEED: &[u8] = b"hardship";

pub const MAX_WILL_URI_LEN: usize = 200;
pub const MAX_LABEL_LEN: usize = 32;
pub const MAX_PAYEE_NAME_LEN: usize = 64;
pub const VERIFIER_COUNT: usize = 3;

// ---------------------------------------------------------------- enums (Borsh order matters)

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum EstateStatus {
    Active,
    DeathPending,
    Unlocked,
    Frozen,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Category {
    Tuition,
    Accommodation,
    Books,
    Medical,
    General,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PayeeKind {
    University,
    School,
    Landlord,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Verdict {
    Pending,
    Approved,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ClaimStatus {
    Open,
    Paid,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AssetStatus {
    Held,
    Listed,
    Sold,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum HardshipStatus {
    Open,
    Approved,
    Rejected,
}

// ---------------------------------------------------------------- accounts

/// Seeds: ["estate", owner]
#[account]
#[derive(InitSpace)]
pub struct Estate {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub usdt_mint: Pubkey,
    pub verifiers: [Pubkey; 3],
    pub death_threshold: u8,
    pub claim_threshold: u8,
    pub hardship_threshold: u8,
    pub waiting_period_secs: i64,
    pub status: EstateStatus,
    pub will_hash: [u8; 32],
    #[max_len(200)]
    pub will_uri: String,
    pub death_cert_hash: [u8; 32],
    pub death_submitted_by: Pubkey,
    pub death_verdict: Verdict,
    /// Bitmap: verifier i sets bit 1 << i.
    pub death_attestations: u8,
    pub death_pending_since: i64,
    pub last_heartbeat: i64,
    pub rule_count: u16,
    pub bump: u8,
}

impl Estate {
    /// Index (0..3) of `key` in the verifier list.
    pub fn verifier_index(&self, key: &Pubkey) -> Option<usize> {
        self.verifiers.iter().position(|v| v == key)
    }

    pub fn clear_death_claim(&mut self) {
        self.death_cert_hash = [0u8; 32];
        self.death_submitted_by = Pubkey::default();
        self.death_verdict = Verdict::Pending;
        self.death_attestations = 0;
        self.death_pending_since = 0;
    }
}

/// Seeds: ["beneficiary", estate, wallet]
#[account]
#[derive(InitSpace)]
pub struct Beneficiary {
    pub estate: Pubkey,
    pub wallet: Pubkey,
    #[max_len(32)]
    pub label: String,
    pub active: bool,
    pub bump: u8,
}

/// Seeds: ["payee", estate, wallet]
#[account]
#[derive(InitSpace)]
pub struct Payee {
    pub estate: Pubkey,
    pub wallet: Pubkey,
    pub kind: PayeeKind,
    #[max_len(64)]
    pub name: String,
    pub bump: u8,
}

/// Seeds: ["rule", estate, id.to_le_bytes() (u16)]
#[account]
#[derive(InitSpace)]
pub struct Rule {
    pub estate: Pubkey,
    pub id: u16,
    /// Beneficiary wallet (not the Beneficiary PDA).
    pub beneficiary: Pubkey,
    pub category: Category,
    pub allowed_payee_kind: PayeeKind,
    pub max_per_claim: u64,
    pub lifetime_cap: u64,
    pub spent_total: u64,
    pub valid_until: i64,
    pub claim_count: u32,
    /// Living plan: claims (and scheduled payments) work while the estate is still Active.
    pub starts_now: bool,
    /// Scheduled payment per interval; 0 = not recurring.
    pub recurring_amount: u64,
    pub interval_secs: i64,
    /// Unix time the next scheduled payment may be executed.
    pub next_due: i64,
    /// Payee wallet of the scheduled payment; Pubkey::default() = none.
    pub fixed_payee: Pubkey,
    pub bump: u8,
}

/// Seeds: ["claim", rule, id.to_le_bytes() (u32)]
#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub estate: Pubkey,
    pub rule: Pubkey,
    pub id: u32,
    /// Beneficiary wallet.
    pub beneficiary: Pubkey,
    /// Payee wallet.
    pub payee: Pubkey,
    pub amount: u64,
    pub evidence_hash: [u8; 32],
    pub agent_verdict: Verdict,
    pub agent_report_hash: [u8; 32],
    /// Bitmap: verifier i sets bit 1 << i.
    pub approvals: u8,
    pub status: ClaimStatus,
    pub created_at: i64,
    /// Set by `owner_approve_claim` (living plans, estate Active): replaces the verifier quorum.
    pub owner_approved: bool,
    pub bump: u8,
}

/// Seeds: ["asset", estate, nft_mint]
#[account]
#[derive(InitSpace)]
pub struct Asset {
    pub estate: Pubkey,
    pub nft_mint: Pubkey,
    pub floor_price: u64,
    pub hardship_floor: u64,
    pub asking_price: u64,
    pub proceeds_to: Pubkey,
    pub status: AssetStatus,
    pub listing_ends: i64,
    pub doc_hash: [u8; 32],
    pub hardship_beneficiary: Option<Pubkey>,
    pub bump: u8,
}

/// Seeds: ["offer", asset, buyer]
#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub asset: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    pub bump: u8,
}

/// Seeds: ["hardship", asset, beneficiary_wallet]
#[account]
#[derive(InitSpace)]
pub struct Hardship {
    pub asset: Pubkey,
    /// Beneficiary wallet.
    pub beneficiary: Pubkey,
    pub evidence_hash: [u8; 32],
    pub agent_verdict: Verdict,
    pub agent_report_hash: [u8; 32],
    /// Bitmap: verifier i sets bit 1 << i.
    pub approvals: u8,
    pub status: HardshipStatus,
    pub bump: u8,
}
