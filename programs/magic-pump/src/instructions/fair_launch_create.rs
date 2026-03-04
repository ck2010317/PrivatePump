use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3,
        CreateMetadataAccountsV3,
        Metadata,
    },
    token::{mint_to, set_authority, Mint, MintTo, SetAuthority, Token, TokenAccount},
};
use crate::constants::*;
use crate::errors::MagicPumpError;
use crate::events::{CreateTokenEvent, FairLaunchCreatedEvent};
use crate::state::{BondingCurve, FairLaunchConfig, Global};

#[derive(Accounts)]
pub struct FairLaunchCreate<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = bonding_curve,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + BondingCurve::INIT_SPACE,
        seeds = [BONDING_CURVE_SEED, mint.key().as_ref()],
        bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + FairLaunchConfig::INIT_SPACE,
        seeds = [FAIR_LAUNCH_SEED, bonding_curve.key().as_ref()],
        bump,
    )]
    pub fair_launch: Account<'info, FairLaunchConfig>,

    #[account(
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    /// CHECK: Metaplex metadata account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<FairLaunchCreate>,
    name: String,
    symbol: String,
    uri: String,
    max_buy_sol: u64,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LENGTH, MagicPumpError::NameTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LENGTH, MagicPumpError::SymbolTooLong);
    require!(uri.len() <= MAX_URI_LENGTH, MagicPumpError::UriTooLong);

    let global = &ctx.accounts.global;
    let mint_key = ctx.accounts.mint.key();
    let curve_bump = ctx.bumps.bonding_curve;
    let signer_seeds: &[&[&[u8]]] = &[&[BONDING_CURVE_SEED, mint_key.as_ref(), &[curve_bump]]];

    // Mint total supply to bonding curve
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        global.token_total_supply,
    )?;

    // Create Metaplex metadata
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.bonding_curve.to_account_info(),
                payer: ctx.accounts.creator.to_account_info(),
                update_authority: ctx.accounts.bonding_curve.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        ),
        anchor_spl::metadata::mpl_token_metadata::types::DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )?;

    // Revoke mint authority
    set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                account_or_mint: ctx.accounts.mint.to_account_info(),
                current_authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
        None,
    )?;

    // Initialize bonding curve with fair launch
    let clock = Clock::get()?;
    let window_end_slot = clock.slot + global.fair_launch_window_slots;
    let bonding_curve_key = ctx.accounts.bonding_curve.key();
    let creator_key = ctx.accounts.creator.key();
    let mint_key_event = ctx.accounts.mint.key();

    let curve = &mut ctx.accounts.bonding_curve;
    curve.mint = ctx.accounts.mint.key();
    curve.creator = ctx.accounts.creator.key();
    curve.virtual_token_reserves = global.initial_virtual_token_reserves;
    curve.virtual_sol_reserves = global.initial_virtual_sol_reserves;
    curve.real_token_reserves = global.initial_real_token_reserves;
    curve.real_sol_reserves = 0;
    curve.token_total_supply = global.token_total_supply;
    curve.complete = false;
    curve.is_delegated = false;
    curve.is_fair_launch = true;
    curve.fair_launch_end_slot = window_end_slot;
    curve.created_at = clock.unix_timestamp;
    curve.total_trades = 0;
    curve.bump = curve_bump;

    // Initialize fair launch config
    let fair_launch = &mut ctx.accounts.fair_launch;
    fair_launch.bonding_curve = bonding_curve_key;
    fair_launch.creator = creator_key;
    fair_launch.window_end_slot = window_end_slot;
    fair_launch.total_committed_sol = 0;
    fair_launch.total_orders = 0;
    fair_launch.is_revealed = false;
    fair_launch.max_buy_sol = max_buy_sol;
    fair_launch.bump = ctx.bumps.fair_launch;

    let vsr = curve.virtual_sol_reserves;
    let vtr = curve.virtual_token_reserves;
    emit!(CreateTokenEvent {
        mint: mint_key_event,
        creator: creator_key,
        name,
        symbol,
        uri,
        virtual_sol_reserves: vsr,
        virtual_token_reserves: vtr,
        timestamp: clock.unix_timestamp,
    });

    emit!(FairLaunchCreatedEvent {
        mint: mint_key_event,
        creator: creator_key,
        window_end_slot,
        max_buy_sol,
    });

    Ok(())
}
