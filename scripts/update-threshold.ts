import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const rpcUrl = "https://devnet.helius-rpc.com/?api-key=50ba9804-e917-4742-af67-35d227c9fbe3";
  const connection = new Connection(rpcUrl, "confirmed");

  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" });
  const program = new Program(idl, provider);

  const [globalPda] = PublicKey.findProgramAddressSync([Buffer.from("global")], programId);

  // Lower graduation threshold to 1 SOL for devnet testing
  const newThreshold = 1 * LAMPORTS_PER_SOL;
  console.log(`Setting graduation threshold to 1 SOL (${newThreshold} lamports)...`);

  const tx = await program.methods
    .updateConfig({
      feeRecipient: null,
      feeBasisPoints: null,
      erValidator: null,
      erCommitFrequencyMs: null,
      fairLaunchWindowSlots: null,
      graduationThresholdSol: new anchor.BN(newThreshold),
    })
    .accounts({
      authority: wallet.publicKey,
      global: globalPda,
    })
    .signers([wallet])
    .rpc();

  console.log("Updated! tx:", tx);

  // Verify
  const accounts = program.account as any;
  const global = await accounts["global"].fetch(globalPda);
  console.log("New graduation threshold:", Number(global.graduationThresholdSol) / LAMPORTS_PER_SOL, "SOL");
}

main().catch(console.error);
