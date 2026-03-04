import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

  // Step 1: Check if global is initialized
  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );
  console.log("Global PDA:", globalPda.toBase58());

  const globalInfo = await connection.getAccountInfo(globalPda);
  if (!globalInfo) {
    console.log("Global not initialized! Run init-global.ts first.");
    console.log("Initializing now...");

    const ER_VALIDATOR = new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd");
    const tx = await program.methods
      .initialize({
        feeRecipient: wallet.publicKey,
        feeBasisPoints: 100,
        erValidator: ER_VALIDATOR,
        vrfOracleQueue: wallet.publicKey,
      })
      .accounts({
        authority: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();
    console.log("Initialized global! Tx:", tx);
  } else {
    console.log("Global already initialized.");
  }

  // Step 2: Create a token
  console.log("\n--- Creating token ---");

  // Import SDK client logic inline
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");

  const mint = Keypair.generate();
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.publicKey.toBuffer()],
    programId
  );
  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, bondingCurve, true);

  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
    METADATA_PROGRAM_ID
  );

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

  console.log("Mint:", mint.publicKey.toBase58());
  console.log("BondingCurve PDA:", bondingCurve.toBase58());

  try {
    const tx = await program.methods
      .createToken("TestMagicToken", "TMT", "https://example.com/token.json")
      .accounts({
        creator: wallet.publicKey,
        mint: mint.publicKey,
        bondingCurve,
        bondingCurveTokenAccount,
        global: globalPda,
        metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: METADATA_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet, mint])
      .rpc();

    console.log("\nToken created successfully!");
    console.log("Transaction:", tx);
    console.log("Mint address:", mint.publicKey.toBase58());
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify bonding curve data
    const curveInfo = await connection.getAccountInfo(bondingCurve);
    if (curveInfo) {
      console.log("\nBonding curve account exists! Size:", curveInfo.data.length, "bytes");
    }
  } catch (err: any) {
    console.error("\nFailed to create token:");
    console.error(err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
