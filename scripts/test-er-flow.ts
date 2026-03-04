import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const ER_RPC = "https://devnet-router.magicblock.app";

async function main() {
  // Load wallet
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // L1 connection
  const rpcUrl = "https://devnet.helius-rpc.com/?api-key=50ba9804-e917-4742-af67-35d227c9fbe3";
  const l1Connection = new Connection(rpcUrl, "confirmed");
  const balance = await l1Connection.getBalance(wallet.publicKey);
  console.log("L1 Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  // ER connection
  const erConnection = new Connection(ER_RPC, "confirmed");

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");

  const l1Provider = new anchor.AnchorProvider(l1Connection, new anchor.Wallet(wallet), { commitment: "confirmed" });
  const l1Program = new Program(idl, l1Provider);

  // Use MagicDoge token (one we haven't traded yet)
  const mintAddress = "2HztTeNPZnoVDiXLXFGWe1aoUqC4vhzHPxKjXvZNz5Co";
  const mint = new PublicKey(mintAddress);
  console.log("\nToken: MagicDoge (MDOGE)");
  console.log("Mint:", mintAddress);

  const [globalPda] = PublicKey.findProgramAddressSync([Buffer.from("global")], programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId
  );

  // Check current delegation status — check account owner, not is_delegated byte
  const curveInfo = await l1Connection.getAccountInfo(bondingCurve);
  if (!curveInfo) { console.error("Bonding curve not found!"); return; }
  const isDelegated = curveInfo.owner.toBase58() === DELEGATION_PROGRAM_ID.toBase58();
  console.log("Currently delegated:", isDelegated);
  console.log("Account owner:", curveInfo.owner.toBase58());

  // ===== Step 1: Delegate the curve to MagicBlock ER =====
  if (!isDelegated) {
    console.log("\n--- Step 1: Delegating curve to MagicBlock ER ---");

    // Derive delegation PDAs
    // buffer PDA is derived under OUR program, not delegation program
    const [bufferPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("buffer"), bondingCurve.toBuffer()],
      programId
    );
    const [delegationRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegation"), bondingCurve.toBuffer()],
      DELEGATION_PROGRAM_ID
    );
    const [delegationMetadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegation-metadata"), bondingCurve.toBuffer()],
      DELEGATION_PROGRAM_ID
    );

    try {
      const tx = await l1Program.methods
        .delegateCurve(mint)
        .accounts({
          payer: wallet.publicKey,
          global: globalPda,
          bufferBondingCurve: bufferPda,
          delegationRecordBondingCurve: delegationRecord,
          delegationMetadataBondingCurve: delegationMetadata,
          bondingCurve,
          ownerProgram: programId,
          delegationProgram: DELEGATION_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      console.log("Delegation tx:", tx);
      console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      // Wait a moment for ER to pick up the delegation
      console.log("Waiting 5s for ER to sync...");
      await new Promise(r => setTimeout(r, 5000));
    } catch (err: any) {
      console.error("Delegation failed:", err.message || err);
      if (err.logs) err.logs.forEach((l: string) => console.error("  ", l));
      // Continue anyway to test ER trade
    }
  }

  // ===== Step 2: Trade on ER =====
  console.log("\n--- Step 2: ER Buy (trading on MagicBlock ER) ---");

  // Use MagicBlock SDK for proper ER transaction handling
  const { sendAndConfirmMagicTransaction } = await import("@magicblock-labs/ephemeral-rollups-sdk");

  // Create ER provider + program for building the transaction
  const erProvider = new anchor.AnchorProvider(erConnection, new anchor.Wallet(wallet), { commitment: "confirmed" });
  const erProgram = new Program(idl, erProvider);

  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
  const buyerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

  const solAmount = 0.01 * LAMPORTS_PER_SOL;
  const minTokensOut = 0; // no slippage protection for test

  try {
    console.log("Sending er_buy via MagicBlock router...");
    const startTime = Date.now();

    // Build the instruction
    const ix = await erProgram.methods
      .erBuy(new anchor.BN(solAmount), new anchor.BN(minTokensOut))
      .accounts({
        buyer: wallet.publicKey,
        global: globalPda,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    // Create a fresh transaction with the instruction + noop (required by MagicBlock)
    const { Transaction, TransactionInstruction } = await import("@solana/web3.js");
    const txObj = new Transaction();
    txObj.add(ix);

    // Add noop instruction with random data (required for MagicBlock routing)
    const randomBytes = new Uint8Array(5);
    crypto.getRandomValues(randomBytes);
    txObj.add(new TransactionInstruction({
      programId: new PublicKey("11111111111111111111111111111111"),
      keys: [],
      data: Buffer.from(randomBytes),
    }));

    txObj.feePayer = wallet.publicKey;

    // Send via MagicBlock's magic transaction handler (sets blockhash internally)
    const { sendMagicTransaction } = await import("@magicblock-labs/ephemeral-rollups-sdk");
    const tx = await sendMagicTransaction(erConnection, txObj, [wallet], { skipPreflight: true });

    const elapsed = Date.now() - startTime;
    console.log(`\nER Buy successful! (${elapsed}ms)`);
    console.log("Transaction:", tx);

    // Check updated state on ER
    const erCurveInfo = await erConnection.getAccountInfo(bondingCurve);
    if (erCurveInfo) {
      const data = erCurveInfo.data;
      const off = 8;
      console.log("\nER Bonding Curve State:");
      console.log("  virtualTokenReserves:", Number(data.readBigUInt64LE(off + 64)));
      console.log("  virtualSolReserves:", Number(data.readBigUInt64LE(off + 72)));
      console.log("  totalTrades:", Number(data.readBigUInt64LE(off + 123)));
      console.log("  isDelegated:", data[off + 105] === 1);
    }
  } catch (err: any) {
    console.error("\nER Buy failed:", err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((l: string) => console.error("  ", l));
    }
  }

  // ===== Step 3: Verify L1 state hasn't changed yet (ER is ephemeral) =====
  console.log("\n--- Step 3: Verify L1 state (should be unchanged until commit) ---");
  const l1CurveInfo = await l1Connection.getAccountInfo(bondingCurve);
  if (l1CurveInfo) {
    const data = l1CurveInfo.data;
    const off = 8;
    console.log("L1 Bonding Curve State:");
    console.log("  virtualTokenReserves:", Number(data.readBigUInt64LE(off + 64)));
    console.log("  virtualSolReserves:", Number(data.readBigUInt64LE(off + 72)));
    console.log("  totalTrades:", Number(data.readBigUInt64LE(off + 123)));
    console.log("  isDelegated:", data[off + 105] === 1);
  }
}

main().catch(console.error);
