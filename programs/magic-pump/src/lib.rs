use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;

declare_id!("84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");

#[ephemeral]
#[program]
pub mod magic_pump {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_token::handler(ctx, name, symbol, uri)
    }

    pub fn buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        instructions::buy::handler(ctx, sol_amount, min_tokens_out)
    }

    pub fn sell(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        instructions::sell::handler(ctx, token_amount, min_sol_out)
    }

    pub fn delegate_curve(ctx: Context<DelegateCurve>, mint: Pubkey) -> Result<()> {
        instructions::delegate_curve::handler(ctx, mint)
    }

    pub fn er_buy(ctx: Context<ErBuy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        instructions::er_buy::handler(ctx, sol_amount, min_tokens_out)
    }

    pub fn er_sell(ctx: Context<ErSell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        instructions::er_sell::handler(ctx, token_amount, min_sol_out)
    }

    pub fn commit_curve(ctx: Context<CommitCurve>) -> Result<()> {
        instructions::commit_curve::handler(ctx)
    }

    pub fn fair_launch_create(
        ctx: Context<FairLaunchCreate>,
        name: String,
        symbol: String,
        uri: String,
        max_buy_sol: u64,
    ) -> Result<()> {
        instructions::fair_launch_create::handler(ctx, name, symbol, uri, max_buy_sol)
    }

    pub fn fair_launch_buy(ctx: Context<FairLaunchBuy>, sol_amount: u64) -> Result<()> {
        instructions::fair_launch_buy::handler(ctx, sol_amount)
    }

    pub fn fair_launch_reveal<'a>(ctx: Context<'_, '_, 'a, 'a, FairLaunchReveal<'a>>) -> Result<()> {
        instructions::fair_launch_reveal::handler(ctx)
    }

    pub fn request_vrf(ctx: Context<RequestVrf>, request_seed: [u8; 32]) -> Result<()> {
        instructions::request_vrf::handler(ctx, request_seed)
    }

    pub fn consume_vrf(ctx: Context<ConsumeVrf>, randomness: [u8; 32]) -> Result<()> {
        instructions::consume_vrf::handler(ctx, randomness)
    }

    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        instructions::graduate::handler(ctx)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
        instructions::update_config::handler(ctx, params)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::withdraw_fees::handler(ctx)
    }
}
