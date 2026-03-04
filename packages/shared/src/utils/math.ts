import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, TOKEN_DECIMALS, GRADUATION_THRESHOLD_SOL } from "../constants";

export function calculateBuyTokens(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  solAmount: BN
): BN {
  if (solAmount.isZero()) return new BN(0);
  const k = virtualSolReserves.mul(virtualTokenReserves);
  const newVirtualSol = virtualSolReserves.add(solAmount);
  const newVirtualToken = k.div(newVirtualSol).add(new BN(1));
  const tokensOut = virtualTokenReserves.sub(newVirtualToken);
  return tokensOut.isNeg() ? new BN(0) : tokensOut;
}

export function calculateSellSol(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  tokenAmount: BN,
  feeBps: number = 100
): { netSolOut: BN; fee: BN } {
  if (tokenAmount.isZero()) return { netSolOut: new BN(0), fee: new BN(0) };
  const numerator = tokenAmount.mul(virtualSolReserves);
  const denominator = virtualTokenReserves.add(tokenAmount);
  const solOut = numerator.div(denominator);
  const fee = solOut.mul(new BN(feeBps)).div(new BN(10000));
  const netSolOut = solOut.sub(fee);
  return { netSolOut, fee };
}

export function calculatePrice(virtualSolReserves: BN, virtualTokenReserves: BN): number {
  if (virtualTokenReserves.isZero()) return 0;
  return virtualSolReserves.toNumber() / virtualTokenReserves.toNumber();
}

export function calculateMarketCap(virtualSolReserves: BN, virtualTokenReserves: BN, totalSupply: BN): number {
  if (virtualTokenReserves.isZero()) return 0;
  const price = virtualSolReserves.toNumber() / virtualTokenReserves.toNumber();
  return (price * totalSupply.toNumber()) / LAMPORTS_PER_SOL;
}

export function calculateProgress(realSolReserves: BN): number {
  const progress = (realSolReserves.toNumber() / GRADUATION_THRESHOLD_SOL) * 100;
  return Math.min(progress, 100);
}

export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: BN): number {
  return lamports.toNumber() / LAMPORTS_PER_SOL;
}

export function tokensToSmallest(tokens: number): BN {
  return new BN(Math.floor(tokens * Math.pow(10, TOKEN_DECIMALS)));
}

export function smallestToTokens(smallest: BN): number {
  return smallest.toNumber() / Math.pow(10, TOKEN_DECIMALS);
}
