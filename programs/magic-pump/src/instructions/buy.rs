use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::TradeEvent;
use crate::math::calculate_buy_tokens;
use crate::state::{BondingCurve, Global};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    /// CHECK: Validated against global.fee_recipient
    #[account(
        mut,
        constraint = fee_recipient.key() == global.fee_recipient
    )]
    pub fee_recipient: UncheckedAccount<'info>,

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
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    let curve = &ctx.accounts.bonding_curve;
    require!(!curve.complete, MagicPumpError::CurveComplete);
    require!(!curve.is_delegated, MagicPumpError::CurveDelegated);

    // Check fair launch window
    if curve.is_fair_launch {
        let clock = Clock::get()?;
        require!(
            clock.slot >= curve.fair_launch_end_slot,
            MagicPumpError::FairLaunchActive
        );
    }

    let tokens_out = calculate_buy_tokens(
        curve.virtual_sol_reserves,
        curve.virtual_token_reserves,
        sol_amount,
    )?;

    // Cap tokens_out to available real reserves
    let tokens_out = std::cmp::min(tokens_out, curve.real_token_reserves);
    require!(tokens_out >= min_tokens_out, MagicPumpError::SlippageExceeded);

    // Calculate fee
    let fee = (sol_amount as u128)
        .checked_mul(ctx.accounts.global.fee_basis_points as u128)
        .ok_or(MagicPumpError::MathOverflow)?
        .checked_div(10000)
        .ok_or(MagicPumpError::MathOverflow)? as u64;

    let sol_to_curve = sol_amount
        .checked_sub(fee)
        .ok_or(MagicPumpError::MathOverflow)?;

    // Transfer SOL to bonding curve
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.bonding_curve.to_account_info(),
            },
        ),
        sol_to_curve,
    )?;

    // Transfer fee to fee_recipient
    if fee > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_recipient.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // Transfer tokens from bonding curve to buyer
    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        BONDING_CURVE_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.bonding_curve.bump],
    ]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.bonding_curve_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        tokens_out,
    )?;

    // Update reserves
    let curve = &mut ctx.accounts.bonding_curve;
    curve.virtual_token_reserves = curve
        .virtual_token_reserves
        .checked_sub(tokens_out)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.virtual_sol_reserves = curve
        .virtual_sol_reserves
        .checked_add(sol_amount)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.real_token_reserves = curve
        .real_token_reserves
        .checked_sub(tokens_out)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.real_sol_reserves = curve
        .real_sol_reserves
        .checked_add(sol_to_curve)
        .ok_or(MagicPumpError::MathOverflow)?;
    curve.total_trades = curve.total_trades.checked_add(1).unwrap_or(curve.total_trades);

    // Check graduation
    if curve.real_sol_reserves >= ctx.accounts.global.graduation_threshold_sol {
        curve.complete = true;
    }

    let clock = Clock::get()?;
    emit!(TradeEvent {
        mint: ctx.accounts.mint.key(),
        trader: ctx.accounts.buyer.key(),
        sol_amount,
        token_amount: tokens_out,
        is_buy: true,
        is_er: false,
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        real_sol_reserves: curve.real_sol_reserves,
        real_token_reserves: curve.real_token_reserves,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
