pub mod claims;
pub mod death;
pub mod sale;
pub mod setup;

pub use claims::*;
pub use death::*;
pub use sale::*;
pub use setup::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, TransferChecked};

pub(crate) fn now() -> Result<i64> {
    Ok(Clock::get()?.unix_timestamp)
}

/// Number of set bits in an approval bitmap.
pub(crate) fn count_bits(bitmap: u8) -> u8 {
    bitmap.count_ones() as u8
}

/// `transfer_checked` CPI. Pass `&[]` as `signer_seeds` when the authority signs the transaction.
pub(crate) fn transfer_checked_cpi<'info>(
    token_program: Pubkey,
    from: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let accounts = TransferChecked {
        from,
        mint,
        to,
        authority,
    };
    token::transfer_checked(
        CpiContext::new_with_signer(token_program, accounts, signer_seeds),
        amount,
        decimals,
    )
}

/// `close_account` CPI signed by a PDA; the rent goes to `destination`.
pub(crate) fn close_token_account_cpi<'info>(
    token_program: Pubkey,
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let accounts = CloseAccount {
        account,
        destination,
        authority,
    };
    token::close_account(CpiContext::new_with_signer(token_program, accounts, signer_seeds))
}
