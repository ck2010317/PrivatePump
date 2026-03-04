use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::DelegationEvent;
use crate::state::{BondingCurve, Global};

#[delegate]
#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct DelegateCurve<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        del,
        seeds = [BONDING_CURVE_SEED, mint.as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
}

pub fn handler(ctx: Context<DelegateCurve>, mint: Pubkey) -> Result<()> {
    let curve = &ctx.accounts.bonding_curve;
    require!(!curve.complete, MagicPumpError::CurveComplete);
    require!(
        ctx.accounts.payer.key() == curve.creator
            || ctx.accounts.payer.key() == ctx.accounts.global.authority,
        MagicPumpError::Unauthorized
    );

    let global = &ctx.accounts.global;

    // Delegate the bonding curve account to the ER
    // Note: is_delegated is NOT set here because the delegation CPI transfers
    // account ownership. The ER will set is_delegated on its copy.
    // Frontend detects delegation by checking account owner != our program.
    ctx.accounts.delegate_bonding_curve(
        &ctx.accounts.payer,
        &[BONDING_CURVE_SEED, mint.as_ref()],
        DelegateConfig {
            commit_frequency_ms: global.er_commit_frequency_ms,
            validator: Some(global.er_validator),
            ..Default::default()
        },
    )?;

    // Mark the curve as delegated so L1 buy/sell are blocked
    // and commit_curve can execute on the ER copy
    let curve = &mut ctx.accounts.bonding_curve;
    curve.is_delegated = true;

    let clock = Clock::get()?;
    emit!(DelegationEvent {
        mint,
        delegated: true,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
