import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  imageUrl?: string;
  description?: string;
  creator: string;
  createdAt: Date;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  isComplete: boolean;
  isDelegated: boolean;
  isFairLaunch: boolean;
  priceInSol: number;
  priceInUsd: number;
  marketCapSol: number;
  marketCapUsd: number;
  volume24hSol: number;
  volume24hUsd: number;
  priceChange24h: number;
  totalTrades: number;
  holderCount: number;
  graduatedAt?: Date;
}

export interface TradeData {
  id: string;
  signature: string;
  mint: string;
  trader: string;
  isBuy: boolean;
  solAmount: BN;
  tokenAmount: BN;
  priceInSol: number;
  feeAmount: BN;
  timestamp: Date;
  isEr: boolean;
}

export interface ChatMessage {
  id: string;
  mint: string;
  sender: string;
  content: string;
  createdAt: Date;
}

export interface UserProfile {
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  tokensCreated: number;
  tokensGraduated: number;
  totalTradeCount: number;
  totalVolumeSol: number;
  totalPnlSol: number;
  winRate: number;
}

export interface LeaderboardEntry {
  rank: number;
  walletOrMint: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export type LeaderboardCategory =
  | "traders_volume"
  | "traders_pnl"
  | "creators"
  | "tokens_mcap"
  | "tokens_volume";

export type LeaderboardPeriod = "daily" | "weekly" | "all_time";

export type TokenSortBy = "newest" | "trending" | "market_cap" | "volume" | "graduating";
export type TokenFilter = "all" | "active" | "graduated" | "fair_launch";
