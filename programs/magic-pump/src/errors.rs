use anchor_lang::prelude::*;

#[error_code]
pub enum MagicPumpError {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Bonding curve is already complete")]
    CurveComplete,
    #[msg("Bonding curve is delegated to ER, use ER endpoint")]
    CurveDelegated,
    #[msg("Bonding curve is not delegated to ER")]
    CurveNotDelegated,
    #[msg("Fair launch window is still active")]
    FairLaunchActive,
    #[msg("Fair launch window has ended")]
    FairLaunchEnded,
    #[msg("Fair launch has already been revealed")]
    FairLaunchAlreadyRevealed,
    #[msg("Amount exceeds fair launch maximum buy")]
    ExceedsMaxBuy,
    #[msg("Insufficient SOL balance")]
    InsufficientSol,
    #[msg("Insufficient token balance")]
    InsufficientTokens,
    #[msg("Mathematical overflow")]
    MathOverflow,
    #[msg("Invalid fee basis points")]
    InvalidFeeBps,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Token name too long")]
    NameTooLong,
    #[msg("Token symbol too long")]
    SymbolTooLong,
    #[msg("Token URI too long")]
    UriTooLong,
    #[msg("VRF result not yet fulfilled")]
    VrfNotFulfilled,
    #[msg("Token has not graduated")]
    NotGraduated,
    #[msg("Invalid token amount")]
    InvalidAmount,
}
