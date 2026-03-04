use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::state::Global;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateConfigParams {
    pub fee_recipient: Option<Pubkey>,
    pub fee_basis_points: Option<u16>,
    pub er_validator: Option<Pubkey>,
    pub er_commit_frequency_ms: Option<u32>,
    pub fair_launch_window_slots: Option<u64>,
    pub graduation_threshold_sol: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = authority.key() == global.authority @ MagicPumpError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,
}

pub fn handler(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
    let global = &mut ctx.accounts.global;

    if let Some(fee_recipient) = params.fee_recipient {
        global.fee_recipient = fee_recipient;
    }
    if let Some(fee_bps) = params.fee_basis_points {
        require!(fee_bps <= MAX_FEE_BASIS_POINTS, MagicPumpError::InvalidFeeBps);
        global.fee_basis_points = fee_bps;
    }
    if let Some(validator) = params.er_validator {
        global.er_validator = validator;
    }
    if let Some(freq) = params.er_commit_frequency_ms {
        global.er_commit_frequency_ms = freq;
    }
    if let Some(slots) = params.fair_launch_window_slots {
        global.fair_launch_window_slots = slots;
    }
    if let Some(threshold) = params.graduation_threshold_sol {
        global.graduation_threshold_sol = threshold;
    }

    Ok(())
}
