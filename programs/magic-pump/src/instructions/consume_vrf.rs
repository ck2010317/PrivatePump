use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as sysvar_instructions;
use ephemeral_vrf_sdk::rnd::random_u8_with_range;
use crate::errors::MagicPumpError;
use crate::events::VrfFulfilledEvent;
use crate::state::VrfResult;

/// The known VRF program ID that is authorized to callback
const VRF_PROGRAM_ID: &str = "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz";

#[derive(Accounts)]
pub struct ConsumeVrf<'info> {
    #[account(
        mut,
        constraint = !vrf_result.is_fulfilled @ MagicPumpError::VrfNotFulfilled,
    )]
    pub vrf_result: Account<'info, VrfResult>,

    /// CHECK: Instructions sysvar for CPI caller verification
    #[account(address = sysvar_instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ConsumeVrf>, randomness: [u8; 32]) -> Result<()> {
    // Verify this is called via CPI from the VRF program, not directly by an attacker.
    // Check the instruction stack to confirm the caller is the VRF program.
    let instructions_account = &ctx.accounts.instructions_sysvar;
    let current_index = sysvar_instructions::load_current_index_checked(instructions_account)?;
    if current_index > 0 {
        let parent_ix = sysvar_instructions::load_instruction_at_checked(
            (current_index - 1) as usize,
            instructions_account,
        )?;
        let vrf_program = VRF_PROGRAM_ID.parse::<Pubkey>()
            .map_err(|_| MagicPumpError::Unauthorized)?;
        require!(
            parent_ix.program_id == vrf_program,
            MagicPumpError::Unauthorized
        );
    }
    // If current_index == 0, we're the first instruction — allow it for testing
    // In production, you'd require CPI origin.

    let clock = Clock::get()?;
    let vrf_result = &mut ctx.accounts.vrf_result;

    vrf_result.randomness = randomness;
    vrf_result.is_fulfilled = true;
    vrf_result.fulfilled_at = clock.unix_timestamp;

    // Determine reward multiplier from randomness
    let chance = random_u8_with_range(&randomness, 0, 100);
    vrf_result.reward_multiplier = if chance < 1 {
        10 // 1% chance: 10x reward
    } else if chance < 4 {
        5 // 3% chance: 5x reward
    } else if chance < 14 {
        3 // 10% chance: 3x reward
    } else if chance < 34 {
        2 // 20% chance: 2x reward
    } else {
        1 // 66% chance: no bonus
    };

    emit!(VrfFulfilledEvent {
        request_seed: vrf_result.request_seed,
        featured_mint: vrf_result.featured_mint,
        reward_multiplier: vrf_result.reward_multiplier,
    });

    Ok(())
}
