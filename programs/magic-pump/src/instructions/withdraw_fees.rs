use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::state::Global;

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        constraint = authority.key() == global.authority @ MagicPumpError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    /// CHECK: Fee recipient wallet
    #[account(
        mut,
        constraint = fee_recipient.key() == global.fee_recipient
    )]
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>) -> Result<()> {
    // Fees are transferred directly to fee_recipient during L1 trades.
    // For ER trades, fees accumulate in the bonding curve lamports.
    // This instruction allows the authority to verify fee state.
    //
    // In the current model, fees go directly to fee_recipient on each L1 trade,
    // and ER fees accumulate in the bonding curve (settled when undelegated).
    // This instruction serves as an admin verification endpoint.

    msg!(
        "Fee recipient: {} | Authority: {}",
        ctx.accounts.fee_recipient.key(),
        ctx.accounts.authority.key()
    );

    Ok(())
}
