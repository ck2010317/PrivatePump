use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FairLaunchConfig {
    pub bonding_curve: Pubkey,
    pub creator: Pubkey,
    pub window_end_slot: u64,
    pub total_committed_sol: u64,
    pub total_orders: u32,
    pub is_revealed: bool,
    pub max_buy_sol: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FairLaunchOrder {
    pub buyer: Pubkey,
    pub fair_launch: Pubkey,
    pub sol_amount: u64,
    pub is_executed: bool,
    pub bump: u8,
}
