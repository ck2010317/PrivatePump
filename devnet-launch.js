#!/usr/bin/env node

/**
 * PrivatePump Devnet Token Launch
 * Real on-chain token creation on Solana devnet
 */

const anchor = require("@coral-xyz/anchor");
const {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");
const fs = require("fs");

const connection = new anchor.web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

async function launchToken(walletPath, tokenName, tokenSymbol) {
  try {
    // Load wallet
    const walletSecret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    const walletKeypair = Keypair.fromSecretKey(Buffer.from(walletSecret));

    console.log(`\n${"═".repeat(70)}`);
    console.log(`🚀 PRIVATEPUMP DEVNET LAUNCH`);
    console.log(`${"═".repeat(70)}`);
    console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
    console.log(`Token: ${tokenName} (${tokenSymbol})`);

    // Check wallet balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);

    if (balance < 5000000) {
      console.log(`\n❌ Insufficient balance. Need at least 0.005 SOL`);
      console.log(
        `Get devnet SOL: https://faucet.solana.com/?devnet-solana`
      );
      return;
    }

    // Create mint
    console.log(`\n📝 Creating mint account...`);
    const mint = Keypair.generate();
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);

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

    console.log(`✅ Mint created!`);
    console.log(`   TX: ${mintTxSig}`);

    // Create associated token account
    console.log(`\n📝 Creating token account...`);
    const ata = await getAssociatedTokenAddress(mint.publicKey, walletKeypair.publicKey);

    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey,
        ata,
        walletKeypair.publicKey,
        mint.publicKey
      )
    );

    const ataTxSig = await sendAndConfirmTransaction(
      connection,
      createAtaTx,
      [walletKeypair]
    );

    console.log(`✅ Token account created!`);
    console.log(`   TX: ${ataTxSig}`);

    // Mint tokens
    console.log(`\n📝 Minting 1B tokens...`);
    const mintTokensTx = new Transaction().add(
      createMintToInstruction(
        mint.publicKey,
        ata,
        walletKeypair.publicKey,
        BigInt(1e15) // 1B with 6 decimals
      )
    );

    const mintTokensTxSig = await sendAndConfirmTransaction(
      connection,
      mintTokensTx,
      [walletKeypair]
    );

    console.log(`✅ Tokens minted!`);
    console.log(`   TX: ${mintTokensTxSig}`);

    // Success output
    console.log(`\n${"═".repeat(70)}`);
    console.log(`✨ TOKEN LAUNCHED SUCCESSFULLY ON DEVNET`);
    console.log(`${"═".repeat(70)}`);

    console.log(`\n📊 TOKEN DETAILS:`);
    console.log(`   Name:     ${tokenName}`);
    console.log(`   Symbol:   ${tokenSymbol}`);
    console.log(`   Supply:   1,000,000,000`);
    console.log(`   Decimals: 6`);

    console.log(`\n⛓️  BLOCKCHAIN:`);
    console.log(`   Mint:     ${mint.publicKey.toString()}`);
    console.log(`   ATA:      ${ata.toString()}`);
    console.log(`   Owner:    ${walletKeypair.publicKey.toString()}`);

    console.log(`\n🔗 VERIFY ON BLOCK EXPLORERS:`);
    console.log(
      `   Solscan:  https://solscan.io/token/${mint.publicKey.toString()}?cluster=devnet`
    );
    console.log(
      `   Solflare: https://solflare.com/tokens/${mint.publicKey.toString()}`
    );

    console.log(`\n${"═".repeat(70)}\n`);

    return mint.publicKey.toString();
  } catch (err) {
    console.error("\n❌ Launch failed:", err.message);
    process.exit(1);
  }
}

// Run
const tokenName = process.argv[2] || "MyToken";
const tokenSymbol = (process.argv[3] || tokenName).toUpperCase();
const walletPath =
  process.argv[4] || `${process.env.HOME}/.config/solana/id.json`;

console.log(`\nUsing wallet: ${walletPath}`);

if (!fs.existsSync(walletPath)) {
  console.error(`\n❌ Wallet not found at: ${walletPath}`);
  console.error(
    `   Set up devnet wallet: solana config set --url devnet`
  );
  process.exit(1);
}

launchToken(walletPath, tokenName, tokenSymbol)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
