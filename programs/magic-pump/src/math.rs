use crate::errors::MagicPumpError;
use anchor_lang::prelude::*;

/// Calculate tokens received for a given SOL input (constant product AMM).
/// Formula: tokens_out = virtual_token - (virtual_sol * virtual_token) / (virtual_sol + sol_in) - 1
pub fn calculate_buy_tokens(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    sol_amount: u64,
) -> Result<u64> {
    require!(sol_amount > 0, MagicPumpError::InvalidAmount);

    let k = (virtual_sol_reserves as u128)
        .checked_mul(virtual_token_reserves as u128)
        .ok_or(MagicPumpError::MathOverflow)?;

    let new_virtual_sol = (virtual_sol_reserves as u128)
        .checked_add(sol_amount as u128)
        .ok_or(MagicPumpError::MathOverflow)?;

    let new_virtual_token = k
        .checked_div(new_virtual_sol)
        .ok_or(MagicPumpError::MathOverflow)?
        .checked_add(1)
        .ok_or(MagicPumpError::MathOverflow)?;

    let tokens_out = (virtual_token_reserves as u128)
        .checked_sub(new_virtual_token)
        .ok_or(MagicPumpError::MathOverflow)?;

    Ok(tokens_out as u64)
}

/// Calculate SOL received and fee for a given token input.
/// Formula: sol_out = (token_amount * virtual_sol) / (virtual_token + token_amount)
/// Returns (net_sol_out, fee_amount)
pub fn calculate_sell_sol(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_amount: u64,
    fee_basis_points: u16,
) -> Result<(u64, u64)> {
    require!(token_amount > 0, MagicPumpError::InvalidAmount);

    let numerator = (token_amount as u128)
        .checked_mul(virtual_sol_reserves as u128)
        .ok_or(MagicPumpError::MathOverflow)?;

    let denominator = (virtual_token_reserves as u128)
        .checked_add(token_amount as u128)
        .ok_or(MagicPumpError::MathOverflow)?;

    let sol_out = numerator
        .checked_div(denominator)
        .ok_or(MagicPumpError::MathOverflow)?;

    let fee = sol_out
        .checked_mul(fee_basis_points as u128)
        .ok_or(MagicPumpError::MathOverflow)?
        .checked_div(10000)
        .ok_or(MagicPumpError::MathOverflow)?;

    let net_sol_out = sol_out
        .checked_sub(fee)
        .ok_or(MagicPumpError::MathOverflow)?;

    Ok((net_sol_out as u64, fee as u64))
}

/// Calculate the current price of a token in SOL (lamports per token).
pub fn calculate_price_lamports(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
) -> u64 {
    if virtual_token_reserves == 0 {
        return 0;
    }
    // Price = virtual_sol / virtual_token (in lamports per smallest token unit)
    // We multiply by 10^6 (token decimals) to get price per whole token
    let price = (virtual_sol_reserves as u128)
        .checked_mul(1_000_000)
        .unwrap_or(0)
        / (virtual_token_reserves as u128);
    price as u64
}

/// Calculate market cap in lamports.
pub fn calculate_market_cap_lamports(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_total_supply: u64,
) -> u64 {
    if virtual_token_reserves == 0 {
        return 0;
    }
    let mc = (virtual_sol_reserves as u128)
        .checked_mul(token_total_supply as u128)
        .unwrap_or(0)
        / (virtual_token_reserves as u128);
    mc as u64
}

/// Calculate bonding curve progress (0-100).
pub fn calculate_progress(real_sol_reserves: u64, graduation_threshold: u64) -> u8 {
    if graduation_threshold == 0 {
        return 100;
    }
    let progress = (real_sol_reserves as u128)
        .checked_mul(100)
        .unwrap_or(0)
        / (graduation_threshold as u128);
    // Clamp before casting to avoid u8 truncation for values > 255
    let clamped = std::cmp::min(progress, 100);
    clamped as u8
}
