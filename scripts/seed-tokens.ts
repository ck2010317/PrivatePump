import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const SAMPLE_TOKENS = [
  { name: "MagicDoge", symbol: "MDOGE", uri: "https://arweave.net/placeholder1" },
  { name: "PumpCat", symbol: "PCAT", uri: "https://arweave.net/placeholder2" },
  { name: "SolanaVibes", symbol: "VIBES", uri: "https://arweave.net/placeholder3" },
];

async function main() {
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Creator:", wallet.publicKey.toBase58());

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const idlPath = path.resolve(__dirname, "../target/idl/magic_pump.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  const programId = new PublicKey(idl.address || "84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk");
  const program = new Program(idl, provider);

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );

  for (const token of SAMPLE_TOKENS) {
    console.log(`\nCreating token: ${token.name} (${token.symbol})`);

    const mint = Keypair.generate();
    console.log("Mint:", mint.publicKey.toBase58());

    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mint.publicKey.toBuffer()],
      programId
    );

    const [bondingCurveAta] = PublicKey.findProgramAddressSync(
      [bondingCurve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );

    try {
      const tx = await program.methods
        .createToken(token.name, token.symbol, token.uri)
        .accounts({
          creator: wallet.publicKey,
          mint: mint.publicKey,
          bondingCurve,
          bondingCurveTokenAccount: bondingCurveAta,
          global: globalPda,
          metadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet, mint])
        .rpc();

      console.log(`Created! Tx: ${tx}`);
    } catch (err: any) {
      console.error(`Error creating ${token.name}:`, err.message || err);
    }
  }
}

main().catch(console.error);
