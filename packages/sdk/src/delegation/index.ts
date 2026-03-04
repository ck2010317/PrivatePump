import { Connection } from "@solana/web3.js";
import { MAGIC_ROUTER_DEVNET, ER_DEVNET_ENDPOINT } from "@privatepump/shared";

export function createMagicRouterConnection(): Connection {
  return new Connection(MAGIC_ROUTER_DEVNET, "confirmed");
}

export function createErConnection(): Connection {
  return new Connection(ER_DEVNET_ENDPOINT, "confirmed");
}
