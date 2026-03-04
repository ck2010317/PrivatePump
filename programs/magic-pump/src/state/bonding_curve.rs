use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BondingCurve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub complete: bool,
    pub is_delegated: bool,
    pub is_fair_launch: bool,
    pub fair_launch_end_slot: u64,
    pub created_at: i64,
    pub total_trades: u64,
    pub bump: u8,
}
