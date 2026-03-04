use anchor_lang::prelude::*;

#[event]
pub struct CreateTokenEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub timestamp: i64,
}

#[event]
pub struct TradeEvent {
    pub mint: Pubkey,
    pub trader: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub is_buy: bool,
    pub is_er: bool,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub timestamp: i64,
}

#[event]
pub struct FairLaunchCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub window_end_slot: u64,
    pub max_buy_sol: u64,
}

#[event]
pub struct FairLaunchOrderEvent {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_amount: u64,
}

#[event]
pub struct FairLaunchRevealedEvent {
    pub mint: Pubkey,
    pub total_orders: u32,
    pub total_sol: u64,
}

#[event]
pub struct GraduationEvent {
    pub mint: Pubkey,
    pub sol_in_pool: u64,
    pub tokens_in_pool: u64,
    pub timestamp: i64,
}

#[event]
pub struct VrfRequestedEvent {
    pub request_seed: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct VrfFulfilledEvent {
    pub request_seed: [u8; 32],
    pub featured_mint: Pubkey,
    pub reward_multiplier: u8,
}

#[event]
pub struct DelegationEvent {
    pub mint: Pubkey,
    pub delegated: bool,
    pub timestamp: i64,
}
