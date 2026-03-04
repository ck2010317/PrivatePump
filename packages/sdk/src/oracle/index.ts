import { Connection, PublicKey } from "@solana/web3.js";

const PYTH_HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const SOL_USD_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

export interface PriceData {
  price: number;
  confidence: number;
  timestamp: number;
}

let cachedPrice: PriceData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

export async function fetchSolPrice(): Promise<PriceData> {
  const now = Date.now();
  if (cachedPrice && now - cacheTimestamp < CACHE_TTL) {
    return cachedPrice;
  }

  try {
    const response = await fetch(`${PYTH_HERMES_URL}?ids[]=${SOL_USD_FEED_ID}`);
    const data = await response.json();
    const parsed = data.parsed?.[0];
    if (parsed) {
      const priceInfo = parsed.price;
      const price = Number(priceInfo.price) * Math.pow(10, priceInfo.expo);
      const confidence = Number(priceInfo.conf) * Math.pow(10, priceInfo.expo);
      cachedPrice = { price, confidence, timestamp: parsed.price.publish_time };
      cacheTimestamp = now;
      return cachedPrice;
    }
  } catch (error) {
    console.error("Failed to fetch SOL price:", error);
  }

  return cachedPrice || { price: 0, confidence: 0, timestamp: 0 };
}
