pub const GLOBAL_SEED: &[u8] = b"global";
pub const BONDING_CURVE_SEED: &[u8] = b"bonding-curve";
pub const FAIR_LAUNCH_SEED: &[u8] = b"fair-launch";
pub const FAIR_ORDER_SEED: &[u8] = b"fair-order";
pub const VRF_RESULT_SEED: &[u8] = b"vrf-result";

pub const TOKEN_DECIMALS: u8 = 6;
pub const TOKEN_TOTAL_SUPPLY: u64 = 1_000_000_000_000_000; // 1B tokens * 10^6
pub const INITIAL_VIRTUAL_TOKEN_RESERVES: u64 = 1_073_000_000_000_000;
pub const INITIAL_VIRTUAL_SOL_RESERVES: u64 = 30_000_000_000; // 30 SOL in lamports
pub const INITIAL_REAL_TOKEN_RESERVES: u64 = 793_100_000_000_000; // 793.1M tradable tokens
pub const GRADUATION_THRESHOLD_SOL: u64 = 85_000_000_000; // 85 SOL in lamports
pub const DEFAULT_FEE_BASIS_POINTS: u16 = 100; // 1%
pub const MAX_FEE_BASIS_POINTS: u16 = 1000; // 10% max
pub const DEFAULT_ER_COMMIT_FREQUENCY_MS: u32 = 5000;
pub const DEFAULT_FAIR_LAUNCH_WINDOW_SLOTS: u64 = 300; // ~2 minutes at 400ms slots

pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;
