use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VrfResult {
    pub request_seed: [u8; 32],
    pub randomness: [u8; 32],
    pub featured_mint: Pubkey,
    pub reward_multiplier: u8,
    pub is_fulfilled: bool,
    pub requested_at: i64,
    pub fulfilled_at: i64,
    pub bump: u8,
}
