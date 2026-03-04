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
use crate::events::CreateTokenEvent;
use crate::state::{BondingCurve, Global};

#[derive(Accounts)]
pub struct CreateToken<'info> {
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
        seeds = [GLOBAL_SEED],
        bump = global.bump,
    )]
    pub global: Account<'info, Global>,

    /// CHECK: Metaplex metadata account, validated by the metadata program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateToken>, name: String, symbol: String, uri: String) -> Result<()> {
    require!(name.len() <= MAX_NAME_LENGTH, MagicPumpError::NameTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LENGTH, MagicPumpError::SymbolTooLong);
    require!(uri.len() <= MAX_URI_LENGTH, MagicPumpError::UriTooLong);

    let global = &ctx.accounts.global;
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.bonding_curve;
    let signer_seeds: &[&[&[u8]]] = &[&[BONDING_CURVE_SEED, mint_key.as_ref(), &[bump]]];

    // Mint total supply to bonding curve token account
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
        true,  // is_mutable
        true,  // update_authority_is_signer
        None,  // collection_details
    )?;

    // Revoke mint authority (no more tokens can be minted)
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

    // Initialize bonding curve state
    let clock = Clock::get()?;
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
    curve.is_fair_launch = false;
    curve.fair_launch_end_slot = 0;
    curve.created_at = clock.unix_timestamp;
    curve.total_trades = 0;
    curve.bump = bump;

    emit!(CreateTokenEvent {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        name,
        symbol,
        uri,
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
