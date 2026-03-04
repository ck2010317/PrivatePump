use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::FairLaunchOrderEvent;
use crate::state::{BondingCurve, FairLaunchConfig, FairLaunchOrder};

#[derive(Accounts)]
pub struct FairLaunchBuy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [BONDING_CURVE_SEED, bonding_curve.mint.as_ref()],
        bump = bonding_curve.bump,
        constraint = bonding_curve.is_fair_launch @ MagicPumpError::InvalidAmount,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        seeds = [FAIR_LAUNCH_SEED, bonding_curve.key().as_ref()],
        bump = fair_launch.bump,
        constraint = !fair_launch.is_revealed @ MagicPumpError::FairLaunchAlreadyRevealed,
    )]
    pub fair_launch: Account<'info, FairLaunchConfig>,

    #[account(
        init,
        payer = buyer,
        space = 8 + FairLaunchOrder::INIT_SPACE,
        seeds = [FAIR_ORDER_SEED, fair_launch.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub fair_launch_order: Account<'info, FairLaunchOrder>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FairLaunchBuy>, sol_amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let fair_launch = &ctx.accounts.fair_launch;

    require!(
        clock.slot < fair_launch.window_end_slot,
        MagicPumpError::FairLaunchEnded
    );
    require!(
        sol_amount <= fair_launch.max_buy_sol,
        MagicPumpError::ExceedsMaxBuy
    );
    require!(sol_amount > 0, MagicPumpError::InvalidAmount);

    // Escrow SOL to fair launch PDA
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.fair_launch.to_account_info(),
            },
        ),
        sol_amount,
    )?;

    // Create order record
    let order = &mut ctx.accounts.fair_launch_order;
    order.buyer = ctx.accounts.buyer.key();
    order.fair_launch = ctx.accounts.fair_launch.key();
    order.sol_amount = sol_amount;
    order.is_executed = false;
    order.bump = ctx.bumps.fair_launch_order;

    // Update fair launch totals
    let fair_launch = &mut ctx.accounts.fair_launch;
    fair_launch.total_committed_sol = fair_launch
        .total_committed_sol
        .checked_add(sol_amount)
        .ok_or(MagicPumpError::MathOverflow)?;
    fair_launch.total_orders = fair_launch
        .total_orders
        .checked_add(1)
        .ok_or(MagicPumpError::MathOverflow)?;

    emit!(FairLaunchOrderEvent {
        mint: ctx.accounts.bonding_curve.mint,
        buyer: ctx.accounts.buyer.key(),
        sol_amount,
    });

    Ok(())
}
