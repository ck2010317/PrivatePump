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

  const mintAddress = "8cCT6naR4ZYmkFz366FEWBpVnvHho3y31vxt2AKaQu4K";
  const mint = new PublicKey(mintAddress);

  const [globalPda] = PublicKey.findProgramAddressSync([Buffer.from("global")], programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], programId);

  const globalAccount = await (program.account as any)["global"].fetch(globalPda);
  const feeRecipient = globalAccount.feeRecipient;

  // Check token balance
  const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const tokenAccountInfo = await getAccount(connection, sellerTokenAccount);
  console.log("Token balance:", Number(tokenAccountInfo.amount) / 1e6, "tokens");

  // Fetch bonding curve state
  const curveInfo = await connection.getAccountInfo(bondingCurve);
  if (!curveInfo) { console.error("Bonding curve not found!"); return; }
  const data = curveInfo.data;
  const off = 8;
  const virtualTokenReserves = Number(data.readBigUInt64LE(off + 64));
  const virtualSolReserves = Number(data.readBigUInt64LE(off + 72));
  console.log("\nBonding curve state:");
  console.log("  virtualTokenReserves:", virtualTokenReserves);
  console.log("  virtualSolReserves:", virtualSolReserves);

  // Sell half the tokens we have
  const tokenBalance = Number(tokenAccountInfo.amount);
  const sellAmount = Math.floor(tokenBalance / 2);
  const expectedSolOut = (sellAmount * virtualSolReserves) / (virtualTokenReserves + sellAmount);
  const fee = expectedSolOut * 0.01;
  const netSol = expectedSolOut - fee;
  const minSolOut = Math.floor(netSol * 0.95); // 5% slippage

  console.log(`\nSelling ${sellAmount / 1e6} tokens`);
  console.log(`Expected SOL out: ${netSol / LAMPORTS_PER_SOL} SOL`);

  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  try {
    const tx = await program.methods
      .sell(new anchor.BN(sellAmount), new anchor.BN(minSolOut))
      .accounts({
        seller: wallet.publicKey,
        global: globalPda,
        feeRecipient,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log("\nSell successful!");
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify new state
    const newCurveInfo = await connection.getAccountInfo(bondingCurve);
    if (newCurveInfo) {
      const newData = newCurveInfo.data;
      const newTotalTrades = Number(newData.readBigUInt64LE(off + 123));
      console.log("\nUpdated totalTrades:", newTotalTrades);
    }

    const newTokenInfo = await getAccount(connection, sellerTokenAccount);
    console.log("New token balance:", Number(newTokenInfo.amount) / 1e6, "tokens");
  } catch (err: any) {
    console.error("\nSell failed:");
    console.error(err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
