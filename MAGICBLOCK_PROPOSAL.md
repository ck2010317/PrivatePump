# MagicPump: Anti-Snipe Token Launchpad on MagicBlock

## One-Liner

A pump.fun-style token launchpad where every trade runs on MagicBlock Ephemeral Rollups — giving users 50ms trades, bot-proof fair launches, and VRF-powered rewards.

---

## The Problem

pump.fun does $500M+ in monthly volume but has three fundamental flaws:

**1. Bots eat the launch.** MEV bots monitor the mempool and front-run every new token within milliseconds. On pump.fun, bots routinely capture 50%+ of early supply before any human can buy. Real users get worse prices every time.

**2. Trades are slow.** Solana's 400ms slot time means each buy/sell takes 400ms-2s to confirm. For a memecoin launchpad where speed is the entire UX, this feels sluggish.

**3. Orders are public.** Every pending transaction is visible in the mempool. Large buy orders signal intent, inviting sandwich attacks and copycat bots. There's no way to buy without showing your hand.

---

## The Solution: MagicBlock Ephemeral Rollups

We're building MagicPump to use three MagicBlock primitives that make these problems disappear:

### 1. ER-Powered Trading (50ms vs 400ms)

Every token's bonding curve can be **delegated to a MagicBlock Ephemeral Rollup**. Once delegated, all buy/sell trades execute on the ER at ~50ms instead of waiting for Solana slots.

The flow:
- Token creator clicks "Enable Fast Mode"
- Bonding curve account is delegated to MagicBlock's ER via the Delegation Program
- All trades route through the ER endpoint (`er_buy` / `er_sell` instructions)
- State commits back to Solana L1 every 5 seconds via `commit_curve`
- Users get instant confirmations; L1 remains the source of truth

This is an 8x speed improvement over regular Solana trading, and it's completely transparent to the user — they just see faster trades.

### 2. Fair Launch with Blind Ordering (Anti-Snipe)

This is the feature that only MagicBlock makes possible. We're building a **commit-reveal fair launch** where bot sniping is mathematically impossible:

**Phase 1 — Blind Commitment (2-minute window):**
- Token launches with a fair launch window (~2 minutes)
- Buyers commit SOL during this window, but **no tokens are distributed yet** — SOL is escrowed in a PDA
- Per-buyer caps prevent any single wallet from dominating
- Nobody — not bots, not whales, not the creator — can see the final price until the window closes

**Phase 2 — Atomic Reveal:**
- After the window closes, a single transaction processes ALL orders at once
- Token allocations are calculated using the bonding curve formula
- Every buyer who committed during the window gets tokens at the same effective price
- There is no ordering to exploit, no transactions to front-run, no MEV to extract

**Why MagicBlock is critical here:** By running the commitment phase on an Ephemeral Rollup, the committed amounts are hidden from the L1 mempool entirely. Bots can't see how much SOL has been committed in real-time — they're completely blind. Without MagicBlock's ER, the commitment amounts would be visible on L1, giving bots partial information to game the system.

### 3. VRF-Powered Gamified Rewards

Using **MagicBlock's Ephemeral VRF**, we'll add provably fair random rewards to trading:

- A VRF request generates 32 bytes of cryptographic randomness via the oracle queue
- The randomness determines a reward multiplier with weighted probabilities:
  - 1% chance of 10x multiplier
  - 3% chance of 5x
  - 10% chance of 3x
  - 20% chance of 2x
  - 66% chance of 1x (no bonus)

This creates a "lottery ticket" mechanic for every trade — provably fair, on-chain verified, impossible to manipulate. Featured tokens get amplified visibility, driving organic engagement.

---

## Why Only MagicBlock

None of this works without MagicBlock's specific capabilities:

| Capability | Why We Need It |
|-----------|---------------|
| **Account delegation** | Bonding curve state lives on ER during active trading |
| **Sub-50ms execution** | Trades confirm before bots can react |
| **Mempool privacy** | ER batching hides order sizes from L1 observers |
| **Periodic L1 commits** | Solana remains source of truth without sacrificing speed |
| **Ephemeral VRF** | On-chain randomness for reward multipliers |

Other L2 solutions (rollups, sidechains) either sacrifice Solana composability or don't provide the account-level delegation model we need. MagicBlock's ER is the only infrastructure that lets us keep a single program on Solana while selectively accelerating specific accounts.

---

## Architecture

```
         User (Browser + Phantom Wallet)
              │              │
         L1 Trades     ER Trades (Fast Mode)
              │              │
   ┌──────────▼───┐  ┌──────▼──────────────────┐
   │  SOLANA L1   │  │  MAGICBLOCK ER           │
   │              │  │                          │
   │  create      │  │  er_buy  (~50ms)         │
   │  buy / sell  │  │  er_sell (~50ms)         │
   │  delegate    │◄─│  commit  (→ L1 / 5sec)   │
   │  fair_launch │  │                          │
   │  graduate    │  │  Private order batching   │
   │  VRF         │  │  Accumulated fee settle   │
   └──────────────┘  └─────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │  GRADUATION  │
   │  → Raydium   │
   │  (85 SOL)    │
   └──────────────┘
```

---

## Bonding Curve Economics

We're matching pump.fun's proven constant-product AMM model:

| Parameter | Value |
|-----------|-------|
| Total supply | 1 billion tokens |
| Tradable on curve | 793M (79.3%) |
| Initial virtual SOL | 30 SOL |
| Graduation target | 85 SOL (~$69K at current prices) |
| Trading fee | 1% |

When real SOL reserves reach 85 SOL, the token graduates and migrates liquidity to Raydium. Same economics as pump.fun — users already understand this model.

---

## pump.fun vs MagicPump

| | pump.fun | MagicPump |
|---|----------|-----------|
| Trade speed | 400ms-2s | **~50ms** |
| Bot protection | None | **Blind ordering + atomic reveal** |
| Mempool privacy | None | **ER batching hides orders** |
| MEV resistance | None | **No tx reordering possible** |
| Per-buyer caps | None | **Configurable max buy** |
| Gamification | None | **VRF reward multipliers** |
| Trading mode | L1 only | **L1 + ER (creator choice)** |

---

## Tech Stack

- **Smart Contract:** Rust + Anchor 0.32 (16 instructions)
- **MagicBlock:** `ephemeral-rollups-sdk` v0.8 + `ephemeral-vrf-sdk` v0.2
- **Frontend:** Next.js + React + TailwindCSS + Solana Wallet Adapter
- **Real-time:** Socket.io for live trade feeds and chat
- **Network:** Solana Devnet now, mainnet-ready architecture

---

## Current Status

- Solana program deployed on devnet with all 16 instructions
- Frontend functional with real on-chain data (token creation, buy, sell, bonding curves)
- ER delegation and `er_buy` tested end-to-end on MagicBlock devnet
- All unit and integration tests passing (10/10)
- Fair launch and VRF instructions written, ready for frontend integration

---

## What We're Looking For

- Feedback on our use of Ephemeral Rollups — are we using the delegation/commit model correctly?
- Access to MagicBlock mainnet infrastructure when ready to launch
- Guidance on optimizing ER commit frequency for our use case (trading volume vs L1 settlement cost)
- Potential grant or ecosystem support for a launch that showcases MagicBlock's ER capabilities in a high-visibility consumer app
