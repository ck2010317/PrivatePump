import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  PROGRAM_ID, MAGIC_ROUTER_DEVNET, BONDING_CURVE_SEED, GLOBAL_SEED,
  FAIR_LAUNCH_SEED, FAIR_ORDER_SEED, VRF_RESULT_SEED,
} from "@privatepump/shared";
import {
  deriveGlobalPda, deriveBondingCurvePda, deriveFairLaunchPda,
  deriveFairOrderPda, deriveVrfResultPda,
} from "@privatepump/shared";

export class PrivatePumpClient {
  public program: Program;
  public provider: AnchorProvider;
  public erConnection: Connection;

  constructor(program: Program, erEndpoint: string = MAGIC_ROUTER_DEVNET) {
    this.program = program;
    this.provider = program.provider as AnchorProvider;
    this.erConnection = new Connection(erEndpoint, "confirmed");
  }

  // -----------------------------------------------------------------------
  // Admin
  // -----------------------------------------------------------------------

  async initialize(params: {
    feeRecipient: PublicKey;
    feeBasisPoints: number;
    erValidator: PublicKey;
    vrfOracleQueue: PublicKey;
  }) {
    const [globalPda] = deriveGlobalPda();
    return this.program.methods
      .initialize({
        feeRecipient: params.feeRecipient,
        feeBasisPoints: params.feeBasisPoints,
        erValidator: params.erValidator,
        vrfOracleQueue: params.vrfOracleQueue,
      })
      .accounts({
        authority: this.provider.wallet.publicKey,
        global: globalPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async updateConfig(params: {
    feeRecipient?: PublicKey | null;
    feeBasisPoints?: number | null;
    erValidator?: PublicKey | null;
    erCommitFrequencyMs?: number | null;
    fairLaunchWindowSlots?: BN | null;
    graduationThresholdSol?: BN | null;
  }) {
    const [globalPda] = deriveGlobalPda();
    return this.program.methods
      .updateConfig({
        feeRecipient: params.feeRecipient ?? null,
        feeBasisPoints: params.feeBasisPoints ?? null,
        erValidator: params.erValidator ?? null,
        erCommitFrequencyMs: params.erCommitFrequencyMs ?? null,
        fairLaunchWindowSlots: params.fairLaunchWindowSlots ?? null,
        graduationThresholdSol: params.graduationThresholdSol ?? null,
      })
      .accounts({
        authority: this.provider.wallet.publicKey,
        global: globalPda,
      })
      .rpc();
  }

  async withdrawFees() {
    const [globalPda] = deriveGlobalPda();
    const global = await this.fetchGlobal();
    return this.program.methods
      .withdrawFees()
      .accounts({
        authority: this.provider.wallet.publicKey,
        global: globalPda,
        feeRecipient: global.feeRecipient,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // -----------------------------------------------------------------------
  // Token Lifecycle
  // -----------------------------------------------------------------------

  async createToken(params: { name: string; symbol: string; uri: string }) {
    const mint = Keypair.generate();
    const [bondingCurve] = deriveBondingCurvePda(mint.publicKey);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, bondingCurve, true);

    const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      METADATA_PROGRAM_ID
    );

    const tx = await this.program.methods
      .createToken(params.name, params.symbol, params.uri)
      .accounts({
        creator: this.provider.wallet.publicKey,
        mint: mint.publicKey,
        bondingCurve,
        bondingCurveTokenAccount,
        global: globalPda,
        metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    return { tx, mint: mint.publicKey, bondingCurve };
  }

  // -----------------------------------------------------------------------
  // L1 Trading
  // -----------------------------------------------------------------------

  async buy(mint: PublicKey, solAmount: BN, minTokensOut: BN) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
    const buyerTokenAccount = getAssociatedTokenAddressSync(mint, this.provider.wallet.publicKey);

    const global = await this.fetchGlobal();

    return this.program.methods
      .buy(solAmount, minTokensOut)
      .accounts({
        buyer: this.provider.wallet.publicKey,
        global: globalPda,
        feeRecipient: global.feeRecipient,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async sell(mint: PublicKey, tokenAmount: BN, minSolOut: BN) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
    const sellerTokenAccount = getAssociatedTokenAddressSync(mint, this.provider.wallet.publicKey);

    const global = await this.fetchGlobal();

    return this.program.methods
      .sell(tokenAmount, minSolOut)
      .accounts({
        seller: this.provider.wallet.publicKey,
        global: globalPda,
        feeRecipient: global.feeRecipient,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // -----------------------------------------------------------------------
  // ER (Ephemeral Rollup) Trading
  // -----------------------------------------------------------------------

  async delegateCurve(mint: PublicKey) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();

    return this.program.methods
      .delegateCurve(mint)
      .accounts({
        payer: this.provider.wallet.publicKey,
        global: globalPda,
        bondingCurve,
      })
      .rpc();
  }

  async erBuy(mint: PublicKey, solAmount: BN, minTokensOut: BN) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
    const buyerTokenAccount = getAssociatedTokenAddressSync(mint, this.provider.wallet.publicKey);

    return this.program.methods
      .erBuy(solAmount, minTokensOut)
      .accounts({
        buyer: this.provider.wallet.publicKey,
        global: globalPda,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async erSell(mint: PublicKey, tokenAmount: BN, minSolOut: BN) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);
    const sellerTokenAccount = getAssociatedTokenAddressSync(mint, this.provider.wallet.publicKey);

    return this.program.methods
      .erSell(tokenAmount, minSolOut)
      .accounts({
        seller: this.provider.wallet.publicKey,
        global: globalPda,
        mint,
        bondingCurve,
        bondingCurveTokenAccount,
        sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async commitCurve(mint: PublicKey) {
    const [bondingCurve] = deriveBondingCurvePda(mint);

    return this.program.methods
      .commitCurve()
      .accounts({
        payer: this.provider.wallet.publicKey,
        bondingCurve,
      })
      .rpc();
  }

  // -----------------------------------------------------------------------
  // Fair Launch
  // -----------------------------------------------------------------------

  async fairLaunchCreate(params: {
    name: string;
    symbol: string;
    uri: string;
    maxBuySol: BN;
  }) {
    const mint = Keypair.generate();
    const [bondingCurve] = deriveBondingCurvePda(mint.publicKey);
    const [globalPda] = deriveGlobalPda();
    const [fairLaunch] = deriveFairLaunchPda(bondingCurve);
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, bondingCurve, true);

    const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      METADATA_PROGRAM_ID
    );

    const tx = await this.program.methods
      .fairLaunchCreate(params.name, params.symbol, params.uri, params.maxBuySol)
      .accounts({
        creator: this.provider.wallet.publicKey,
        mint: mint.publicKey,
        bondingCurve,
        bondingCurveTokenAccount,
        fairLaunch,
        global: globalPda,
        metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    return { tx, mint: mint.publicKey, bondingCurve, fairLaunch };
  }

  async fairLaunchBuy(mint: PublicKey, solAmount: BN) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [fairLaunch] = deriveFairLaunchPda(bondingCurve);
    const [fairOrder] = deriveFairOrderPda(fairLaunch, this.provider.wallet.publicKey);

    return this.program.methods
      .fairLaunchBuy(solAmount)
      .accounts({
        buyer: this.provider.wallet.publicKey,
        bondingCurve,
        fairLaunch,
        fairLaunchOrder: fairOrder,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async fairLaunchReveal(mint: PublicKey, orderAccounts: { order: PublicKey; buyerTokenAccount: PublicKey }[]) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const [fairLaunch] = deriveFairLaunchPda(bondingCurve);
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);

    const remainingAccounts = orderAccounts.flatMap(({ order, buyerTokenAccount }) => [
      { pubkey: order, isWritable: true, isSigner: false },
      { pubkey: buyerTokenAccount, isWritable: true, isSigner: false },
    ]);

    return this.program.methods
      .fairLaunchReveal()
      .accounts({
        authority: this.provider.wallet.publicKey,
        global: globalPda,
        bondingCurve,
        bondingCurveTokenAccount,
        fairLaunch,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();
  }

  // -----------------------------------------------------------------------
  // VRF
  // -----------------------------------------------------------------------

  async requestVrf(requestSeed: Uint8Array, oracleQueue: PublicKey) {
    const [globalPda] = deriveGlobalPda();
    const [vrfResult] = deriveVrfResultPda(requestSeed);

    return this.program.methods
      .requestVrf(Array.from(requestSeed))
      .accounts({
        payer: this.provider.wallet.publicKey,
        global: globalPda,
        vrfResult,
        oracleQueue,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // -----------------------------------------------------------------------
  // Graduation
  // -----------------------------------------------------------------------

  async graduate(mint: PublicKey) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [globalPda] = deriveGlobalPda();
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true);

    return this.program.methods
      .graduate()
      .accounts({
        authority: this.provider.wallet.publicKey,
        global: globalPda,
        bondingCurve,
        mint,
        bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // -----------------------------------------------------------------------
  // Account Fetching
  // -----------------------------------------------------------------------

  async fetchBondingCurve(mint: PublicKey) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const accounts = this.program.account as any;
    return accounts["bondingCurve"].fetch(bondingCurve);
  }

  async fetchGlobal() {
    const [globalPda] = deriveGlobalPda();
    const accounts = this.program.account as any;
    return accounts["global"].fetch(globalPda);
  }

  async fetchFairLaunchConfig(mint: PublicKey) {
    const [bondingCurve] = deriveBondingCurvePda(mint);
    const [fairLaunch] = deriveFairLaunchPda(bondingCurve);
    const accounts = this.program.account as any;
    return accounts["fairLaunchConfig"].fetch(fairLaunch);
  }

  async fetchVrfResult(requestSeed: Uint8Array) {
    const [vrfResult] = deriveVrfResultPda(requestSeed);
    const accounts = this.program.account as any;
    return accounts["vrfResult"].fetch(vrfResult);
  }
}
