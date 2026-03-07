import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, getMinimumBalanceForRentExemptMint, MINT_SIZE } from "@solana/spl-token";
import { createCreateMetadataAccountsV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import { PrivatePumpClient } from "./app/src/sdk/client";

const connection = new anchor.web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

async function launchToken(
  walletPath: string,
  tokenName: string,
  tokenSymbol: string,
  tokenUri: string
) {
  // Load wallet
  const walletSecret = require("fs").readFileSync(walletPath, "utf8");
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(walletSecret))
  );
  
  console.log(`\n🚀 PRIVATEPUMP DEVNET LAUNCH`);
  console.log(`=${"=".repeat(68)}`);
  console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`Token: ${tokenName} (${tokenSymbol})`);
  
  try {
    // Create mint keypair
    const mint = Keypair.generate();
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);
    
    console.log(`\n📝 Creating mint account...`);
    console.log(`Mint: ${mint.publicKey.toString()}`);
    
    // Create mint transaction
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: walletKeypair.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        6, // decimals
        walletKeypair.publicKey,
        walletKeypair.publicKey
      )
    );
    
    const mintTxSig = await sendAndConfirmTransaction(
      connection,
      createMintTx,
      [walletKeypair, mint]
    );
    
    console.log(`✅ Mint created: ${mintTxSig}`);
    
    // Create metadata
    console.log(`\n📝 Creating metadata...`);
    const METADATA_PROGRAM_ID = new PublicKey(
      "metaqbxxUerdq28cj1RbAqkChB7VRKo6iDydVT8we1"
    );
    
    const metadataAddress = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    )[0];
    
    const metadataTx = new Transaction().add(
      createCreateMetadataAccountsV3Instruction(
        {
          metadata: metadataAddress,
          mint: mint.publicKey,
          mintAuthority: walletKeypair.publicKey,
          payer: walletKeypair.publicKey,
          updateAuthority: walletKeypair.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: tokenName,
              symbol: tokenSymbol,
              uri: tokenUri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      )
    );
    
    const metadataTxSig = await sendAndConfirmTransaction(
      connection,
      metadataTx,
      [walletKeypair]
    );
    
    console.log(`✅ Metadata created: ${metadataTxSig}`);
    
    console.log(`\n${"=".repeat(70)}`);
    console.log(`✨ TOKEN LAUNCHED SUCCESSFULLY ON DEVNET`);
    console.log(`${"=".repeat(70)}`);
    console.log(`\n📊 TOKEN DETAILS:`);
    console.log(`   Name:     ${tokenName}`);
    console.log(`   Symbol:   ${tokenSymbol}`);
    console.log(`   Mint:     ${mint.publicKey.toString()}`);
    console.log(`\n🔗 VERIFY:`);
    console.log(`   Solscan:  https://solscan.io/token/${mint.publicKey.toString()}?cluster=devnet`);
    console.log(`   Solflare: https://solflare.com/tokens/${mint.publicKey.toString()}`);
    console.log(`\n`);
    
    return mint.publicKey.toString();
  } catch (err) {
    console.error("❌ Launch failed:", err);
    throw err;
  }
}

// Run launch
const tokenName = process.argv[2] || "MyToken";
const tokenSymbol = process.argv[3] || tokenName.toUpperCase();
const walletPath = process.argv[4] || process.env.HOME + "/.config/solana/id.json";
const tokenUri = process.argv[5] || "https://ipfs.io/ipfs/QmNft";

launchToken(walletPath, tokenName, tokenSymbol, tokenUri)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
