import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe("magic-pump", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MagicPump as Program;
  const authority = provider.wallet as anchor.Wallet;

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );

  it("initializes global config", async () => {
    const tx = await program.methods
      .initialize({
        feeRecipient: authority.publicKey,
        feeBasisPoints: 100,
        erValidator: authority.publicKey,
        vrfOracleQueue: authority.publicKey,
      })
      .accounts({
        authority: authority.publicKey,
        global: globalPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize tx:", tx);

    const accounts = program.account as any;
    const globalAccount = await accounts["global"].fetch(globalPda);
    expect(globalAccount.feeBasisPoints).to.equal(100);
    expect(globalAccount.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(globalAccount.feeRecipient.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(globalAccount.isInitialized).to.be.true;
  });

  let mint: Keypair;
  let bondingCurvePda: PublicKey;

  it("creates a token", async () => {
    mint = Keypair.generate();

    [bondingCurvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mint.publicKey.toBuffer()],
      program.programId
    );

    const bondingCurveAta = await getAssociatedTokenAddress(
      mint.publicKey, bondingCurvePda, true
    );

    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );

    const tx = await program.methods
      .createToken("TestToken", "TEST", "https://test.com/metadata.json")
      .accounts({
        creator: authority.publicKey,
        mint: mint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveAta,
        global: globalPda,
        metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    console.log("Create token tx:", tx);

    const accounts = program.account as any;
    const curve = await accounts["bondingCurve"].fetch(bondingCurvePda);
    expect(curve.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(curve.creator.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(curve.complete).to.be.false;
  });

  it("buys tokens", async () => {
    const buyerAta = await getAssociatedTokenAddress(
      mint.publicKey, authority.publicKey
    );

    const bondingCurveAta = await getAssociatedTokenAddress(
      mint.publicKey, bondingCurvePda, true
    );

    const solAmount = new BN(0.1 * LAMPORTS_PER_SOL);
    const minTokens = new BN(0);

    const tx = await program.methods
      .buy(solAmount, minTokens)
      .accounts({
        buyer: authority.publicKey,
        mint: mint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveAta,
        buyerTokenAccount: buyerAta,
        global: globalPda,
        feeRecipient: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Buy tx:", tx);

    const accounts = program.account as any;
    const curve = await accounts["bondingCurve"].fetch(bondingCurvePda);
    expect(Number(curve.totalTrades)).to.equal(1);
  });

  it("sells tokens", async () => {
    const sellerAta = await getAssociatedTokenAddress(
      mint.publicKey, authority.publicKey
    );

    const bondingCurveAta = await getAssociatedTokenAddress(
      mint.publicKey, bondingCurvePda, true
    );

    // Sell a small amount of tokens
    const tokenAmount = new BN(1_000_000);
    const minSol = new BN(0);

    const tx = await program.methods
      .sell(tokenAmount, minSol)
      .accounts({
        seller: authority.publicKey,
        mint: mint.publicKey,
        bondingCurve: bondingCurvePda,
        bondingCurveTokenAccount: bondingCurveAta,
        sellerTokenAccount: sellerAta,
        global: globalPda,
        feeRecipient: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Sell tx:", tx);

    const accounts = program.account as any;
    const curve = await accounts["bondingCurve"].fetch(bondingCurvePda);
    expect(Number(curve.totalTrades)).to.equal(2);
  });
});
