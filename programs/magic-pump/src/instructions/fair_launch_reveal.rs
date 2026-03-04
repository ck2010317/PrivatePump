use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::FairLaunchRevealedEvent;
use crate::math::calculate_buy_tokens;
use crate::state::{BondingCurve, FairLaunchConfig, FairLaunchOrder, Global};

#[derive(Accounts)]
pub struct FairLaunchReveal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [BONDING_CURVE_SEED, bonding_curve.mint.as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        associated_token::mint = bonding_curve.mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [FAIR_LAUNCH_SEED, bonding_curve.key().as_ref()],
        bump = fair_launch.bump,
        constraint = !fair_launch.is_revealed @ MagicPumpError::FairLaunchAlreadyRevealed,
        constraint = authority.key() == fair_launch.creator || authority.key() == global.authority @ MagicPumpError::Unauthorized,
    )]
    pub fair_launch: Account<'info, FairLaunchConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // remaining_accounts: pairs of (FairLaunchOrder, BuyerTokenAccount)
}

pub fn handler<'a>(ctx: Context<'_, '_, 'a, 'a, FairLaunchReveal<'a>>) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.slot >= ctx.accounts.fair_launch.window_end_slot,
        MagicPumpError::FairLaunchActive
    );

    let remaining = ctx.remaining_accounts;
    require!(remaining.len() % 2 == 0, MagicPumpError::InvalidAmount);

    let mint_key = ctx.accounts.bonding_curve.mint;
    let curve_bump = ctx.accounts.bonding_curve.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[BONDING_CURVE_SEED, mint_key.as_ref(), &[curve_bump]]];

    // ---- Uniform Pricing Fair Launch ----
    // All buyers get the same effective price: tokens are distributed proportionally
    // based on their SOL commitment relative to the total.

    let total_committed = ctx.accounts.fair_launch.total_committed_sol;

    if total_committed == 0 {
        ctx.accounts.fair_launch.is_revealed = true;
        emit!(FairLaunchRevealedEvent {
            mint: mint_key,
            total_orders: 0,
            total_sol: 0,
        });
        return Ok(());
    }

    // Calculate total tokens for the entire committed SOL at the current curve price
    let total_tokens = calculate_buy_tokens(
        ctx.accounts.bonding_curve.virtual_sol_reserves,
        ctx.accounts.bonding_curve.virtual_token_reserves,
        total_committed,
    )?;
    let total_tokens = std::cmp::min(total_tokens, ctx.accounts.bonding_curve.real_token_reserves);

    // Transfer committed SOL from fair launch escrow to bonding curve
    let fair_launch_info = ctx.accounts.fair_launch.to_account_info();
    let curve_info = ctx.accounts.bonding_curve.to_account_info();
    let rent = Rent::get()?;
    let fl_min_balance = rent.minimum_balance(fair_launch_info.data_len());
    let available_lamports = fair_launch_info.lamports().saturating_sub(fl_min_balance);
    let transfer_amount = std::cmp::min(total_committed, available_lamports);

    **fair_launch_info.try_borrow_mut_lamports()? -= transfer_amount;
    **curve_info.try_borrow_mut_lamports()? += transfer_amount;

    // Distribute tokens proportionally to each buyer
    let num_pairs = remaining.len() / 2;
    let mut total_tokens_distributed: u64 = 0;

    for i in 0..num_pairs {
        let order_account = &remaining[i * 2];
        let buyer_token_account = &remaining[i * 2 + 1];

        // Validate the order account is owned by our program
        require!(
            order_account.owner == &crate::ID,
            MagicPumpError::Unauthorized
        );

        let order_data = order_account.try_borrow_data()?;
        let order: FairLaunchOrder =
            FairLaunchOrder::try_deserialize(&mut &order_data[..])?;
        drop(order_data);

        // Validate order belongs to this fair launch
        require!(
            order.fair_launch == ctx.accounts.fair_launch.key(),
            MagicPumpError::Unauthorized
        );

        if order.is_executed {
            continue;
        }

        // Proportional share: buyer_tokens = total_tokens * (order.sol / total_committed)
        let buyer_tokens = (total_tokens as u128)
            .checked_mul(order.sol_amount as u128)
            .ok_or(MagicPumpError::MathOverflow)?
            .checked_div(total_committed as u128)
            .ok_or(MagicPumpError::MathOverflow)? as u64;

        if buyer_tokens == 0 {
            continue;
        }

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    to: buyer_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            buyer_tokens,
        )?;

        total_tokens_distributed += buyer_tokens;

        // Mark order as executed
        let mut order_data = order_account.try_borrow_mut_data()?;
        let mut updated_order = FairLaunchOrder::try_deserialize(&mut &order_data[..])?;
        updated_order.is_executed = true;
        let serialized = updated_order.try_to_vec()?;
        order_data[8..8 + serialized.len()].copy_from_slice(&serialized);
    }

    // Update curve reserves once for all orders (uniform pricing)
    ctx.accounts.bonding_curve.virtual_token_reserves = ctx.accounts.bonding_curve
        .virtual_token_reserves
        .checked_sub(total_tokens_distributed)
        .ok_or(MagicPumpError::MathOverflow)?;
    ctx.accounts.bonding_curve.virtual_sol_reserves = ctx.accounts.bonding_curve
        .virtual_sol_reserves
        .checked_add(total_committed)
        .ok_or(MagicPumpError::MathOverflow)?;
    ctx.accounts.bonding_curve.real_token_reserves = ctx.accounts.bonding_curve
        .real_token_reserves
        .checked_sub(total_tokens_distributed)
        .ok_or(MagicPumpError::MathOverflow)?;
    ctx.accounts.bonding_curve.real_sol_reserves = ctx.accounts.bonding_curve
        .real_sol_reserves
        .checked_add(transfer_amount)
        .ok_or(MagicPumpError::MathOverflow)?;
    ctx.accounts.bonding_curve.total_trades += ctx.accounts.fair_launch.total_orders as u64;

    // Check graduation
    if ctx.accounts.bonding_curve.real_sol_reserves >= ctx.accounts.global.graduation_threshold_sol {
        ctx.accounts.bonding_curve.complete = true;
    }

    ctx.accounts.fair_launch.is_revealed = true;

    emit!(FairLaunchRevealedEvent {
        mint: mint_key,
        total_orders: ctx.accounts.fair_launch.total_orders,
        total_sol: ctx.accounts.fair_launch.total_committed_sol,
    });

    Ok(())
}
