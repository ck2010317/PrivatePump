use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::TradeEvent;
use crate::math::calculate_sell_sol;
use crate::state::{BondingCurve, Global};

#[derive(Accounts)]
pub struct ErSell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [BONDING_CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ErSell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
    let curve = &ctx.accounts.bonding_curve;

    let (net_sol_out, fee) = calculate_sell_sol(
        curve.virtual_sol_reserves,
        curve.virtual_token_reserves,
        token_amount,
        ctx.accounts.global.fee_basis_points,
    )?;

    require!(net_sol_out >= min_sol_out, MagicPumpError::SlippageExceeded);
    require!(
        net_sol_out + fee <= curve.real_sol_reserves,
        MagicPumpError::InsufficientSol
    );

    // Transfer tokens from seller to bonding curve
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        token_amount,
    )?;

    // Transfer SOL from bonding curve to seller (on ER, direct lamport manipulation)
    let curve_account = ctx.accounts.bonding_curve.to_account_info();
    let seller_account = ctx.accounts.seller.to_account_info();
    **curve_account.try_borrow_mut_lamports()? -= net_sol_out;
    **seller_account.try_borrow_mut_lamports()? += net_sol_out;

    // Update reserves (fee stays in curve lamports on ER, settled on commit/undelegate)
    let total_sol_deducted = net_sol_out + fee;
    let curve = &mut ctx.accounts.bonding_curve;
    curve.virtual_token_reserves = curve
        .virtual_token_reserves
        .checked_add(token_amount)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.virtual_sol_reserves = curve
        .virtual_sol_reserves
        .checked_sub(total_sol_deducted)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.real_token_reserves = curve
        .real_token_reserves
        .checked_add(token_amount)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.real_sol_reserves = curve
        .real_sol_reserves
        .checked_sub(total_sol_deducted)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.total_trades = curve.total_trades.checked_add(1).unwrap_or(curve.total_trades);

    let clock = Clock::get()?;
    emit!(TradeEvent {
        mint: ctx.accounts.mint.key(),
        trader: ctx.accounts.seller.key(),
        sol_amount: net_sol_out,
        token_amount,
        is_buy: false,
        is_er: true,
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        real_sol_reserves: curve.real_sol_reserves,
        real_token_reserves: curve.real_token_reserves,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
