import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("Wallet:", wallet.publicKey.toBase58());

  const rpcUrl = "https://devnet.helius-rpc.com/?api-key=50ba9804-e917-4742-af67-35d227c9fbe3";
  const connection = new Connection(rpcUrl, "confirmed");

  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  // Use TestMagicToken
  const mintAddress = "8cCT6naR4ZYmkFz366FEWBpVnvHho3y31vxt2AKaQu4K";
  const mint = new PublicKey(mintAddress);
  console.log("\nToken: TestMagicToken (TMT)");

  const [globalPda] = PublicKey.findProgramAddressSync([Buffer.from("global")], programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], programId);

  // Fetch current state
  const accounts = program.account as any;
  const global = await accounts["global"].fetch(globalPda);
  console.log("Graduation threshold:", Number(global.graduationThresholdSol) / LAMPORTS_PER_SOL, "SOL");

  const curveInfo = await connection.getAccountInfo(bondingCurve);
  if (!curveInfo) { console.error("Bonding curve not found!"); return; }
  const data = curveInfo.data;
  const off = 8;
  const realSolReserves = Number(data.readBigUInt64LE(off + 88));
  const complete = data[off + 104] === 1;
  console.log("Current realSolReserves:", realSolReserves / LAMPORTS_PER_SOL, "SOL");
  console.log("Currently complete:", complete);

  const needed = Number(global.graduationThresholdSol) - realSolReserves;
  if (needed <= 0) {
    console.log("\nAlready graduated or past threshold!");
    return;
  }
  console.log("SOL needed to graduate:", needed / LAMPORTS_PER_SOL, "SOL");

  // Buy enough to graduate — buy slightly more than needed to ensure we pass threshold
  const buyAmount = needed + 0.01 * LAMPORTS_PER_SOL;
  console.log(`\n--- Buying ${buyAmount / LAMPORTS_PER_SOL} SOL worth to trigger graduation ---`);

  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
  const buyerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const feeRecipient = global.feeRecipient;

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

  try {
    const tx = await program.methods
      .buy(new anchor.BN(Math.ceil(buyAmount)), new anchor.BN(0))
      .accounts({
        buyer: wallet.publicKey,
        global: globalPda,
        feeRecipient,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log("Buy tx:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Check if graduated
    const newCurveInfo = await connection.getAccountInfo(bondingCurve);
    if (newCurveInfo) {
      const d = newCurveInfo.data;
      const newRealSol = Number(d.readBigUInt64LE(off + 88));
      const newComplete = d[off + 104] === 1;
      const totalTrades = Number(d.readBigUInt64LE(off + 123));
      console.log("\n--- Post-Buy State ---");
      console.log("realSolReserves:", newRealSol / LAMPORTS_PER_SOL, "SOL");
      console.log("complete (GRADUATED):", newComplete);
      console.log("totalTrades:", totalTrades);

      if (newComplete) {
        console.log("\n🎓 TOKEN HAS GRADUATED! Bonding curve is complete.");
      } else {
        console.log("\nNot graduated yet. Still need more SOL.");
      }
    }

    // Check token balance
    const tokenInfo = await getAccount(connection, buyerTokenAccount);
    console.log("Token balance:", Number(tokenInfo.amount) / 1e6, "tokens");
  } catch (err: any) {
    console.error("\nBuy failed:", err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((l: string) => console.error("  ", l));
    }
  }
}

main().catch(console.error);
