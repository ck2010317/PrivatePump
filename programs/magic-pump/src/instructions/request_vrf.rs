use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::*;
use crate::events::VrfRequestedEvent;
use crate::state::{Global, VrfResult};

#[vrf]
#[derive(Accounts)]
#[instruction(request_seed: [u8; 32])]
pub struct RequestVrf<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    #[account(
        init,
        payer = payer,
        space = 8 + VrfResult::INIT_SPACE,
        seeds = [VRF_RESULT_SEED, request_seed.as_ref()],
        bump,
    )]
    pub vrf_result: Account<'info, VrfResult>,

    /// CHECK: Oracle queue account from VRF program
    pub oracle_queue: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestVrf>, request_seed: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;

    // Initialize VRF result
    let vrf_result = &mut ctx.accounts.vrf_result;
    vrf_result.request_seed = request_seed;
    vrf_result.randomness = [0u8; 32];
    vrf_result.featured_mint = Pubkey::default();
    vrf_result.reward_multiplier = 1;
    vrf_result.is_fulfilled = false;
    vrf_result.requested_at = clock.unix_timestamp;
    vrf_result.fulfilled_at = 0;
    vrf_result.bump = ctx.bumps.vrf_result;

    // Build VRF request
    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::ConsumeVrf::DISCRIMINATOR.to_vec(),
        caller_seed: request_seed,
        accounts_metas: Some(vec![
            SerializableAccountMeta {
                pubkey: ctx.accounts.vrf_result.key(),
                is_signer: false,
                is_writable: true,
            },
        ]),
        ..Default::default()
    });

    // Invoke VRF request
    ctx.accounts.invoke_signed_vrf(
        &ctx.accounts.payer.to_account_info(),
        &ix,
    )?;

    emit!(VrfRequestedEvent {
        request_seed,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
