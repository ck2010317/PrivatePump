import { PublicKey } from "@solana/web3.js";

// Program ID: supports both NEXT_PUBLIC_ prefix (Next.js) and bare PROGRAM_ID (Node.js/scripts)
const PROGRAM_ID_STR = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PROGRAM_ID)
  || (typeof process !== 'undefined' && process.env?.PROGRAM_ID)
  || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk";

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);

export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");
export const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");

export const MAGIC_ROUTER_DEVNET = "https://devnet-rpc.magicblock.app";
export const ER_DEVNET_ENDPOINT = "https://devnet.magicblock.app";
export const ER_VALIDATOR_DEVNET = new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd");

export const PYTH_SOL_USD_FEED = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");

export const TOKEN_DECIMALS = 6;
export const TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000; // 1B * 10^6
export const INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000;
export const INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000; // 30 SOL
export const INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000;
export const GRADUATION_THRESHOLD_SOL = 85_000_000_000; // 85 SOL
export const DEFAULT_FEE_BPS = 100; // 1%
export const LAMPORTS_PER_SOL = 1_000_000_000;

export const GLOBAL_SEED = Buffer.from("global");
export const BONDING_CURVE_SEED = Buffer.from("bonding-curve");
export const FAIR_LAUNCH_SEED = Buffer.from("fair-launch");
export const FAIR_ORDER_SEED = Buffer.from("fair-order");
export const VRF_RESULT_SEED = Buffer.from("vrf-result");
