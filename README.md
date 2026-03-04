# PrivatePump 🚀

A **hybrid L1/Ephemeral Rollup** token launchpad on Solana with VRF-powered fair launches, real-time charts, and sub-50ms trading on MagicBlock.

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│          PrivatePump Frontend            │
│      (Next.js 16 + React 19 + Charts)   │
└──────────┬──────────────────────────────┘
           │
      ┌────┴────┐
      │          │
   ┌──▼──┐   ┌──▼──────────┐
   │ L1  │   │ Ephemeral   │
   │ RPC │   │ Rollup (ER) │
   └─────┘   └─────────────┘
      │          │
      └────┬─────┘
           │
    ┌──────▼────────────────────┐
    │  PrivatePump Rust Program  │
    │   (Anchor Framework)       │
    │  ✓ Bonding Curve          │
    │  ✓ Fair Launch (VRF)      │
    │  ✓ Graduation (85 SOL)    │
    │  ✓ ER Delegation          │
    └───────────────────────────┘
```

## 📦 Project Structure

### Frontend & Backend
- **`app/`** - Next.js 16 frontend with real-time charts
- **`server/`** - Socket.io server for real-time updates
- **`packages/sdk/`** - TypeScript SDK for PrivatePump program
- **`packages/shared/`** - Shared types, constants, and utilities

### Rust Smart Contract
- **`programs/magic-pump/`** - Anchor program (Solana/Rust)
  - `src/lib.rs` - Program entry point
  - `src/instructions/` - All 16 trading & admin instructions
  - `src/state/` - Account state definitions
  - `src/math.rs` - Bonding curve mathematics
  - `src/constants.rs` - Program constants (85 SOL graduation threshold)

### Testing & Configuration
- **`tests/`** - TypeScript test suite for bonding curve math
- **`Anchor.toml`** - Anchor framework configuration
- **`Cargo.toml`** - Rust workspace configuration
- **`turbo.json`** - Monorepo build configuration

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and pnpm
- **Rust 1.75+** and Anchor 0.32.1
- **Solana CLI** (for devnet)

### Installation

```bash
# Install dependencies
pnpm install

# Build Rust program
anchor build

# Start dev servers
pnpm --filter server dev  # Terminal 1: Socket.io on :3002
pnpm --filter app dev     # Terminal 2: Next.js on :3000
```

Visit `http://localhost:3000`

## ⚡ Core Features

### 1. **Ephemeral Rollup Trading (ER)**
- Sub-50ms execution on MagicBlock rollups
- Batched L1 settlement every 5 seconds
- ER-specific program: `noopb9bkMVfRPU8AsBHBnYkVKdjy2UrGjVKXpwqXe5H`
- **Flow:** `delegateCurve` → `erBuy`/`erSell` → `commitCurve`

### 2. **VRF-Powered Fair Launch**
- Commitment window with uniform pricing
- Verifiable Random Function reveals fair allocation
- Prevents bot sniping and whale frontrunning
- **Instructions:** `fairLaunchCreate` → `fairLaunchBuy` → `fairLaunchReveal`

### 3. **Automatic Graduation**
- Threshold: **85 SOL** in real reserves
- Access control: creator or program authority
- Transfers SOL + tokens for Raydium AMM creation

### 4. **Real-Time Charts**
- Native candlestick charts (lightweight-charts v5)
- OHLCV data aggregation (1m, 5m, 15m, 1h, 4h, 1d)
- Socket.io live updates
- Synthetic data generation (no DB required)

### 5. **Hybrid L1/ER Mode**
- Choose per-trade: L1 (normal) or ER (fast)
- Unified bonding curve across both modes
- Transparent market cap and progress tracking

## 🔧 Program Details

**Program ID:** `84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk`

### Instructions (16 total)

| Category | Instructions |
|----------|---|
| **Admin** | `initialize`, `updateConfig`, `withdrawFees` |
| **L1 Trading** | `buy`, `sell` |
| **ER Trading** | `delegateCurve`, `erBuy`, `erSell`, `commitCurve` |
| **Fair Launch** | `fairLaunchCreate`, `fairLaunchBuy`, `fairLaunchReveal` |
| **VRF** | `requestVrf`, `consumeVrf` |
| **Graduation** | `graduate` |

### Key Constants

```rust
GRADUATION_THRESHOLD_SOL: 85_000_000_000          // 85 SOL in lamports
TOKEN_TOTAL_SUPPLY: 1_000_000_000_000_000         // 1B tokens × 10^6
INITIAL_VIRTUAL_SOL_RESERVES: 30_000_000_000      // 30 SOL
INITIAL_VIRTUAL_TOKEN_RESERVES: 1_073_000_000_000_000
INITIAL_REAL_TOKEN_RESERVES: 793_100_000_000_000  // 793.1M tradable
DEFAULT_FEE_BASIS_POINTS: 100                     // 1%
FAIR_LAUNCH_WINDOW_SLOTS: 300                     // ~2 minutes
```

## 🛠️ Build & Testing

### Build Rust Program
```bash
anchor build
# Output: target/idl/magic_pump.json + target/types/magic_pump.ts
```

### Run Tests
```bash
# TypeScript bonding curve math tests
cd tests && npm run test:math

# Full Anchor test suite
anchor test
```

### TypeScript Verification
```bash
cd app && npx tsc --noEmit
cd packages/sdk && npx tsc --noEmit
cd packages/shared && npx tsc --noEmit
```

## 📊 API Endpoints

### Tokens
- `GET /api/tokens` - List all tokens
- `GET /api/tokens/[mint]` - Token details
- `GET /api/tokens/[mint]/ohlcv?interval=1m` - Candlestick data
- `GET /api/tokens/[mint]/trades` - Trade history
- `GET /api/tokens/[mint]/chat` - Chat messages

### Other
- `GET /api/leaderboard` - Top traders/creators
- `GET /api/oracle/sol-price` - SOL/USD price
- `GET /api/users/[address]` - User portfolio

## 🌐 Environment Variables

```env
# Solana RPC
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Program
NEXT_PUBLIC_PROGRAM_ID=84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk

# Server
NEXT_PUBLIC_SERVER_URL=http://localhost:3002

# Optional: Database (graceful fallback when unavailable)
DATABASE_URL=postgresql://...
```

## 🎯 Key Differentiators vs Pump.fun

| Feature | Pump.fun | PrivatePump |
|---------|----------|------------|
| **Speed** | 2-4s per trade | 50ms (ER) |
| **Fair Launch** | None | VRF + commitment window |
| **Charts** | External tools only | Native candlesticks |
| **Trading Modes** | L1 only | L1 + ER hybrid |
| **Graduation** | Manual | Automatic at 85 SOL |
| **Cost** | Higher gas | Lower with ER batching |

## 📚 Documentation

- **[MAGICBLOCK_PROPOSAL.md](./MAGICBLOCK_PROPOSAL.md)** - Original proposal
- **[MAGICPUMP_UNIQUE_FEATURES.md](./MAGICPUMP_UNIQUE_FEATURES.md)** - Feature comparison
- **[VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)** - System audit & status

## 🔐 Security Considerations

- ✅ All instructions have access control checks
- ✅ Math operations use safe arithmetic (checked_* methods)
- ✅ Fair launch prevents front-running via commitment window
- ✅ VRF integration for randomness (devnet only)
- ⚠️ Production requires VRF signer configuration

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Ensure tests pass
4. Submit a pull request

---

**Built with:** Rust + Anchor + Next.js + MagicBlock Ephemeral Rollups
