import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ER_VALIDATOR_DEVNET = new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd");

async function main() {
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Authority:", wallet.publicKey.toBase58());

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  if (balance < LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log("Airdrop complete");
  }

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");
  const program = new Program(idl, provider);

  // Derive Global PDA
  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );

  console.log("Global PDA:", globalPda.toBase58());

  // Check if already initialized
  const existing = await connection.getAccountInfo(globalPda);
  if (existing) {
    console.log("Global config already initialized!");
    return;
  }

  // Initialize with params struct matching IDL
  const tx = await program.methods
    .initialize({
      feeRecipient: wallet.publicKey,
      feeBasisPoints: 100, // 1%
      erValidator: ER_VALIDATOR_DEVNET,
      vrfOracleQueue: wallet.publicKey, // placeholder
    })
    .accounts({
      authority: wallet.publicKey,
    })
    .signers([wallet])
    .rpc();

  console.log("Initialized global config! Tx:", tx);
}

main().catch(console.error);
