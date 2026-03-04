use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::state::Global;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub fee_recipient: Pubkey,
    pub fee_basis_points: u16,
    pub er_validator: Pubkey,
    pub vrf_oracle_queue: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Global::INIT_SPACE,
        seeds = [GLOBAL_SEED],
        bump,
    )]
    pub global: Account<'info, Global>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    require!(
        params.fee_basis_points <= MAX_FEE_BASIS_POINTS,
        MagicPumpError::InvalidFeeBps
    );

    let global = &mut ctx.accounts.global;
    global.authority = ctx.accounts.authority.key();
    global.fee_recipient = params.fee_recipient;
    global.fee_basis_points = params.fee_basis_points;
    global.initial_virtual_token_reserves = INITIAL_VIRTUAL_TOKEN_RESERVES;
    global.initial_virtual_sol_reserves = INITIAL_VIRTUAL_SOL_RESERVES;
    global.initial_real_token_reserves = INITIAL_REAL_TOKEN_RESERVES;
    global.token_total_supply = TOKEN_TOTAL_SUPPLY;
    global.graduation_threshold_sol = GRADUATION_THRESHOLD_SOL;
    global.migration_fee_lamports = 0;
    global.er_commit_frequency_ms = DEFAULT_ER_COMMIT_FREQUENCY_MS;
    global.er_validator = params.er_validator;
    global.fair_launch_window_slots = DEFAULT_FAIR_LAUNCH_WINDOW_SLOTS;
    global.vrf_oracle_queue = params.vrf_oracle_queue;
    global.is_initialized = true;
    global.bump = ctx.bumps.global;

    Ok(())
}
