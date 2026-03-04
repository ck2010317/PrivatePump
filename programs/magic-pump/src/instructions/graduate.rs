use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::GraduationEvent;
use crate::state::{BondingCurve, Global};

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [BONDING_CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
        constraint = bonding_curve.complete @ MagicPumpError::NotGraduated,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // Note: In production, additional Raydium accounts would be passed here
    // as remaining_accounts for the CPI to create the liquidity pool.
    // For devnet MVP, graduation marks the token as complete and emits event.
}

pub fn handler(ctx: Context<Graduate>) -> Result<()> {
    let curve = &ctx.accounts.bonding_curve;
    let clock = Clock::get()?;

    // Access control: only creator or global authority can trigger graduation
    require!(
        ctx.accounts.authority.key() == curve.creator
            || ctx.accounts.authority.key() == ctx.accounts.global.authority,
        MagicPumpError::Unauthorized
    );

    let sol_in_pool = curve.real_sol_reserves;
    let tokens_in_pool = ctx.accounts.bonding_curve_token_account.amount;

    // Transfer SOL from bonding curve to authority (for Raydium pool creation)
    // In production, this would CPI to Raydium to create the liquidity pool.
    // For devnet MVP, SOL goes to the authority who will create the pool.
    let mint_key = ctx.accounts.mint.key();
    let bump = curve.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[BONDING_CURVE_SEED, mint_key.as_ref(), &[bump]]];

    // Transfer remaining tokens from bonding curve to authority
    if tokens_in_pool > 0 {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    to: ctx.accounts.authority.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_in_pool,
        ).ok(); // Best-effort: might fail if authority has no token account
    }

    // Transfer SOL from bonding curve PDA to authority
    if sol_in_pool > 0 {
        let rent = Rent::get()?;
        let curve_info = ctx.accounts.bonding_curve.to_account_info();
        let min_balance = rent.minimum_balance(curve_info.data_len());
        let transferable = curve_info.lamports().saturating_sub(min_balance);
        let transfer_sol = std::cmp::min(sol_in_pool, transferable);

        if transfer_sol > 0 {
            let auth_info = ctx.accounts.authority.to_account_info();
            **curve_info.try_borrow_mut_lamports()? -= transfer_sol;
            **auth_info.try_borrow_mut_lamports()? += transfer_sol;
        }
    }

    emit!(GraduationEvent {
        mint: ctx.accounts.mint.key(),
        sol_in_pool,
        tokens_in_pool,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
