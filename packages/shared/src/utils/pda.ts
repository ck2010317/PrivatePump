import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, GLOBAL_SEED, BONDING_CURVE_SEED, FAIR_LAUNCH_SEED, FAIR_ORDER_SEED, VRF_RESULT_SEED } from "../constants";

export function deriveGlobalPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GLOBAL_SEED], PROGRAM_ID);
}

export function deriveBondingCurvePda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([BONDING_CURVE_SEED, mint.toBuffer()], PROGRAM_ID);
}

export function deriveFairLaunchPda(bondingCurve: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FAIR_LAUNCH_SEED, bondingCurve.toBuffer()], PROGRAM_ID);
}

export function deriveFairOrderPda(fairLaunch: PublicKey, buyer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FAIR_ORDER_SEED, fairLaunch.toBuffer(), buyer.toBuffer()], PROGRAM_ID);
}

export function deriveVrfResultPda(requestSeed: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VRF_RESULT_SEED, requestSeed], PROGRAM_ID);
}
