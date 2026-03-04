import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Load wallet
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Connect
  const rpcUrl = "https://devnet.helius-rpc.com/?api-key=50ba9804-e917-4742-af67-35d227c9fbe3";
  const connection = new Connection(rpcUrl, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  const program = new Program(idl, provider);

  // Token to buy
  const mintAddress = "8cCT6naR4ZYmkFz366FEWBpVnvHho3y31vxt2AKaQu4K"; // TestMagicToken
  const mint = new PublicKey(mintAddress);

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId
  );

  // Fetch global to get fee recipient
  const globalAccount = await program.account["global"].fetch(globalPda);
  const feeRecipient = (globalAccount as any).feeRecipient;
  console.log("Fee recipient:", feeRecipient.toBase58());

  // Fetch current bonding curve state
  const curveInfo = await connection.getAccountInfo(bondingCurve);
  if (!curveInfo) {
    console.error("Bonding curve not found!");
    return;
  }
  const data = curveInfo.data;
  const off = 8;
  const virtualTokenReserves = Number(data.readBigUInt64LE(off + 64));
  const virtualSolReserves = Number(data.readBigUInt64LE(off + 72));
  console.log("\nBonding curve state:");
  console.log("  virtualTokenReserves:", virtualTokenReserves);
  console.log("  virtualSolReserves:", virtualSolReserves);

  // Buy 0.01 SOL worth of tokens
  const solAmount = 0.01 * LAMPORTS_PER_SOL; // 10_000_000 lamports
  const k = virtualSolReserves * virtualTokenReserves;
  const expectedTokens = virtualTokenReserves - k / (virtualSolReserves + solAmount);
  const minTokensOut = Math.floor(expectedTokens * 0.95); // 5% slippage

  console.log("\nBuying with", solAmount / LAMPORTS_PER_SOL, "SOL");
  console.log("Expected tokens:", expectedTokens / 1e6, "(in token units)");
  console.log("Min tokens out:", minTokensOut / 1e6, "(with 5% slippage)");

  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
  const buyerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

  try {
    const tx = await program.methods
      .buy(new anchor.BN(solAmount), new anchor.BN(minTokensOut))
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

    console.log("\nBuy successful!");
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify new bonding curve state
    const newCurveInfo = await connection.getAccountInfo(bondingCurve);
    if (newCurveInfo) {
      const newData = newCurveInfo.data;
      const newVirtualTokenReserves = Number(newData.readBigUInt64LE(off + 64));
      const newVirtualSolReserves = Number(newData.readBigUInt64LE(off + 72));
      const newTotalTrades = newData.readUInt32LE(off + 123);
      console.log("\nUpdated bonding curve:");
      console.log("  virtualTokenReserves:", newVirtualTokenReserves, "(was", virtualTokenReserves, ")");
      console.log("  virtualSolReserves:", newVirtualSolReserves, "(was", virtualSolReserves, ")");
      console.log("  totalTrades:", newTotalTrades);
    }
  } catch (err: any) {
    console.error("\nBuy failed:");
    console.error(err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
