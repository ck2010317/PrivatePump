import { expect } from "chai";
import { BN } from "@coral-xyz/anchor";
import { calculateBuyTokens, calculateSellSol, calculatePrice, calculateMarketCap, calculateProgress } from "@magicpump/shared";

describe("bonding-curve-math", () => {
  const INITIAL_VIRTUAL_TOKEN = new BN("1073000000000000");
  const INITIAL_VIRTUAL_SOL = new BN("30000000000"); // 30 SOL in lamports
  const TOKEN_SUPPLY = new BN("1000000000000000");

  it("calculates buy tokens correctly", () => {
    const solIn = new BN("1000000000"); // 1 SOL
    const tokens = calculateBuyTokens(
      INITIAL_VIRTUAL_SOL,
      INITIAL_VIRTUAL_TOKEN,
      solIn
    );

    expect(tokens.toNumber()).to.be.greaterThan(0);
    // Buying 1 SOL at initial reserves should give ~34.5M tokens
    expect(tokens.toNumber() / 1e6).to.be.approximately(34_500_000, 1_000_000);
  });

  it("calculates sell sol correctly", () => {
    const tokenAmount = new BN("34500000000000"); // ~34.5M tokens
    const { netSolOut } = calculateSellSol(
      INITIAL_VIRTUAL_SOL,
      INITIAL_VIRTUAL_TOKEN,
      tokenAmount
    );

    expect(netSolOut.toNumber()).to.be.greaterThan(0);
    // Selling back should give slightly less than 1 SOL (due to price impact + fees)
    expect(netSolOut.toNumber() / 1e9).to.be.lessThan(1);
  });

  it("returns 0 for zero input", () => {
    const buyResult = calculateBuyTokens(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN, new BN(0));
    expect(buyResult.toNumber()).to.equal(0);
    const { netSolOut } = calculateSellSol(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN, new BN(0));
    expect(netSolOut.toNumber()).to.equal(0);
  });

  it("calculates price correctly", () => {
    const price = calculatePrice(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN);
    // Initial price should be ~0.000028 SOL per token
    expect(price).to.be.greaterThan(0);
    expect(price).to.be.approximately(0.000028, 0.000005);
  });

  it("calculates progress correctly", () => {
    const progress0 = calculateProgress(new BN(0));
    expect(progress0).to.equal(0);

    const progressHalf = calculateProgress(new BN("42500000000")); // ~42.5 SOL
    expect(progressHalf).to.be.approximately(50, 1);

    const progressFull = calculateProgress(new BN("85000000000")); // 85 SOL
    expect(progressFull).to.be.approximately(100, 1);
  });

  it("calculates market cap correctly", () => {
    const mcap = calculateMarketCap(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN, TOKEN_SUPPLY);
    // Market cap = price * supply / LAMPORTS_PER_SOL
    expect(mcap).to.be.greaterThan(0);
    expect(mcap).to.be.approximately(28, 5); // ~28 SOL market cap
  });
});
