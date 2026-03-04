use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Global {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_basis_points: u16,
    pub initial_virtual_token_reserves: u64,
    pub initial_virtual_sol_reserves: u64,
    pub initial_real_token_reserves: u64,
    pub token_total_supply: u64,
    pub graduation_threshold_sol: u64,
    pub migration_fee_lamports: u64,
    pub er_commit_frequency_ms: u32,
    pub er_validator: Pubkey,
    pub fair_launch_window_slots: u64,
    pub vrf_oracle_queue: Pubkey,
    pub is_initialized: bool,
    pub bump: u8,
}
