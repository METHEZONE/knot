import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type ParsedTransactionWithMeta,
  type TokenBalance
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { z } from "zod";
import type { GatewayConfig } from "./config.js";

const fundingPrepareRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  termsHash: z.string().min(1),
  totalAmountBaseUnits: z.string().regex(/^\d+$/),
  milestoneIds: z.array(z.string().min(1)).min(1),
  milestoneAmountsBaseUnits: z.array(z.string().regex(/^\d+$/)).min(1),
  mint: z.string().min(1),
  programId: z.string().min(1),
  network: z.string().min(1),
  brandAuthority: z.string().min(1),
  creatorDestination: z.string().min(1),
  settlementAuthority: z.string().min(1)
});

const fundingConfirmRequestSchema = fundingPrepareRequestSchema.extend({
  transactionSignature: z.string().min(1),
  escrowPda: z.string().min(1),
  vaultTokenAccount: z.string().min(1),
  brandTokenAccount: z.string().min(1)
});

const milestoneReleasePrepareRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  milestoneId: z.string().min(1),
  expectedAmountBaseUnits: z.string().regex(/^\d+$/),
  mint: z.string().min(1),
  programId: z.string().min(1),
  network: z.string().min(1),
  creatorDestination: z.string().min(1),
  settlementAuthority: z.string().min(1),
  escrowPda: z.string().min(1),
  vaultTokenAccount: z.string().min(1),
  milestoneIds: z.array(z.string().min(1)).min(1),
  milestoneAmountsBaseUnits: z.array(z.string().regex(/^\d+$/)).min(1)
});

const milestoneReleaseConfirmRequestSchema = milestoneReleasePrepareRequestSchema.extend({
  transactionSignature: z.string().min(1),
  creatorTokenAccount: z.string().min(1)
});

export type FundingPrepareResult = {
  status: "PREPARED";
  agreementId: string;
  escrowId: string;
  network: string;
  mint: string;
  programId: string;
  /** 이 tx 의 네트워크 수수료를 실제로 내는 지갑. 릴레이어 대납 시 유저 지갑이 아니다. */
  feePayer: string;
  /** true 면 유저는 SOL 을 보유할 필요가 없다. */
  gasSponsored: boolean;
  brandAuthority: string;
  creatorDestination: string;
  settlementAuthority: string;
  totalAmountBaseUnits: string;
  brandTokenAccount: string;
  escrowPda: string;
  vaultTokenAccount: string;
  brandUsdcBalanceBaseUnits: string;
  estimatedNetworkFeeLamports: string;
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
};

export type FundingConfirmResult = {
  status: "CONFIRMED";
  agreementId: string;
  escrowId: string;
  network: string;
  mint: string;
  programId: string;
  brandAuthority: string;
  creatorDestination: string;
  settlementAuthority: string;
  totalAmountBaseUnits: string;
  brandTokenAccount: string;
  escrowPda: string;
  vaultTokenAccount: string;
  signature: string;
  explorerUrl: string;
  brandDeltaBaseUnits: string;
  vaultDeltaBaseUnits: string;
  slot: number;
  liveContext: AgreementEscrowLiveContext;
};

export type AgreementEscrowLiveContext = {
  agreementEscrowVersion: "v1";
  escrowId: string;
  escrowPda: string;
  vaultTokenAccount: string;
  brandTokenAccount: string;
  creatorDestination: string;
  settlementAuthority: string;
  mint: string;
  milestoneIds: string[];
  milestoneAmountsBaseUnits: string[];
};

export type AgreementReleaseReceipt = {
  status: "CONFIRMED";
  signature: string;
  explorerUrl: string;
  slot: null;
};

export type MilestoneReleasePrepareResult = {
  status: "PREPARED";
  agreementId: string;
  escrowId: string;
  milestoneId: string;
  network: string;
  mint: string;
  programId: string;
  /** 이 tx 의 네트워크 수수료를 실제로 내는 지갑. 릴레이어 대납 시 유저 지갑이 아니다. */
  feePayer: string;
  /** true 면 유저는 SOL 을 보유할 필요가 없다. */
  gasSponsored: boolean;
  creatorDestination: string;
  settlementAuthority: string;
  expectedAmountBaseUnits: string;
  escrowPda: string;
  vaultTokenAccount: string;
  creatorTokenAccount: string;
  estimatedNetworkFeeLamports: string;
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
};

export type MilestoneReleaseConfirmResult = {
  status: "CONFIRMED";
  agreementId: string;
  escrowId: string;
  milestoneId: string;
  network: string;
  mint: string;
  programId: string;
  creatorDestination: string;
  settlementAuthority: string;
  expectedAmountBaseUnits: string;
  escrowPda: string;
  vaultTokenAccount: string;
  creatorTokenAccount: string;
  signature: string;
  explorerUrl: string;
  vaultDeltaBaseUnits: string;
  creatorDeltaBaseUnits: string;
  slot: number;
};

type FundingPrepareRequest = z.infer<typeof fundingPrepareRequestSchema>;

export async function prepareBrandFunding(
  config: GatewayConfig,
  body: unknown
): Promise<FundingPrepareResult> {
  const input = fundingPrepareRequestSchema.parse(body);
  validateAllowedConfig(config, input);
  const totalAmount = parseBaseUnits(input.totalAmountBaseUnits);
  const milestoneAmounts = input.milestoneAmountsBaseUnits.map(parseBaseUnits);
  requireMilestoneSum(input, milestoneAmounts, totalAmount);

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const programId = new PublicKey(input.programId);
  const mint = new PublicKey(input.mint);
  const brandAuthority = new PublicKey(input.brandAuthority);
  const creatorDestination = new PublicKey(input.creatorDestination);
  const settlementAuthority = new PublicKey(input.settlementAuthority);
  const agreementHash = agreementHashBytes(input.agreementId);
  const escrowPda = pda(["escrow", agreementHash], programId);
  const vaultTokenAccount = getAssociatedTokenAddressSync(mint, escrowPda, true);
  const brandTokenAccount = getAssociatedTokenAddressSync(mint, brandAuthority, false);
  const brandToken = await getAccount(
    connection,
    brandTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  ).catch((error: unknown) => {
    throw new Error(`Brand USDC token account not found: ${readableError(error)}`);
  });
  if (!brandToken.owner.equals(brandAuthority)) {
    throw new Error("Brand USDC token account owner does not match connected wallet");
  }
  if (!brandToken.mint.equals(mint)) {
    throw new Error("Brand USDC token account mint does not match configured USDC mint");
  }
  if (brandToken.amount < totalAmount) {
    throw new Error("Brand USDC balance is below the Agreement total amount");
  }

  const transaction = new Transaction();
  transaction.add(
    initializeEscrowIx({
      programId,
      brandAuthority,
      creatorDestination,
      settlementAuthority,
      mint,
      agreementHash,
      escrowPda,
      vaultTokenAccount,
      milestoneAmounts,
      totalAmount,
      termsHash: input.termsHash
    }),
    fundEscrowIx({
      programId,
      brandAuthority,
      mint,
      brandTokenAccount,
      escrowPda,
      vaultTokenAccount,
      totalAmount
    })
  );
  const latest = await connection.getLatestBlockhash("confirmed");
  const sponsor = sponsorFeePayer(config, transaction, brandAuthority, latest.blockhash);
  const fee = await transaction.getEstimatedFee(connection);

  return {
    status: "PREPARED",
    agreementId: input.agreementId,
    escrowId: input.escrowId,
    network: input.network,
    mint: mint.toBase58(),
    programId: programId.toBase58(),
    feePayer: sponsor.feePayer,
    gasSponsored: sponsor.gasSponsored,
    brandAuthority: brandAuthority.toBase58(),
    creatorDestination: creatorDestination.toBase58(),
    settlementAuthority: settlementAuthority.toBase58(),
    totalAmountBaseUnits: totalAmount.toString(),
    brandTokenAccount: brandTokenAccount.toBase58(),
    escrowPda: escrowPda.toBase58(),
    vaultTokenAccount: vaultTokenAccount.toBase58(),
    brandUsdcBalanceBaseUnits: brandToken.amount.toString(),
    estimatedNetworkFeeLamports: String(fee ?? 5000),
    transactionBase64: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }).toString("base64"),
    recentBlockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight
  };
}

export async function confirmBrandFunding(
  config: GatewayConfig,
  body: unknown
): Promise<FundingConfirmResult> {
  const input = fundingConfirmRequestSchema.parse(body);
  validateAllowedConfig(config, input);
  const totalAmount = parseBaseUnits(input.totalAmountBaseUnits);
  const milestoneAmounts = input.milestoneAmountsBaseUnits.map(parseBaseUnits);
  requireMilestoneSum(input, milestoneAmounts, totalAmount);

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const brandAuthority = new PublicKey(input.brandAuthority);
  const mint = new PublicKey(input.mint);
  const programId = new PublicKey(input.programId);
  const brandTokenAccount = new PublicKey(input.brandTokenAccount);
  const escrowPda = new PublicKey(input.escrowPda);
  const vaultTokenAccount = new PublicKey(input.vaultTokenAccount);
  const creatorDestination = new PublicKey(input.creatorDestination);
  const settlementAuthority = new PublicKey(input.settlementAuthority);
  const expectedEscrow = pda(["escrow", agreementHashBytes(input.agreementId)], programId);
  const expectedVault = getAssociatedTokenAddressSync(mint, expectedEscrow, true);
  const expectedBrandToken = getAssociatedTokenAddressSync(mint, brandAuthority, false);
  if (!escrowPda.equals(expectedEscrow)) {
    throw new Error("Escrow PDA does not match Agreement ID");
  }
  if (!vaultTokenAccount.equals(expectedVault)) {
    throw new Error("Vault token account does not match Agreement escrow PDA");
  }
  if (!brandTokenAccount.equals(expectedBrandToken)) {
    throw new Error("Brand token account does not match connected wallet");
  }

  const tx = await connection.getParsedTransaction(input.transactionSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0
  });
  if (!tx || tx.meta?.err) {
    throw new Error("Funding transaction is not confirmed successfully");
  }
  const signedAccountKeys = tx.transaction.message.accountKeys
    .filter((entry) => entry.signer)
    .map((entry) => entry.pubkey.toBase58());
  if (!signedAccountKeys.includes(brandAuthority.toBase58())) {
    throw new Error("Funding transaction was not signed by the Brand wallet");
  }
  const programAccountKeys = tx.transaction.message.accountKeys.map((entry) =>
    entry.pubkey.toBase58()
  );
  if (!programAccountKeys.includes(programId.toBase58())) {
    throw new Error("Funding transaction does not invoke the configured escrow program");
  }

  const brandToken = await getAccount(
    connection,
    brandTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  const vaultToken = await getAccount(
    connection,
    vaultTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  if (!brandToken.owner.equals(brandAuthority) || !brandToken.mint.equals(mint)) {
    throw new Error("Brand token account owner or mint failed validation");
  }
  if (!vaultToken.owner.equals(escrowPda) || !vaultToken.mint.equals(mint)) {
    throw new Error("Vault token account owner or mint failed validation");
  }

  const brandDelta = tokenDelta(tx, brandTokenAccount, mint);
  const vaultDelta = tokenDelta(tx, vaultTokenAccount, mint);
  if (brandDelta !== -totalAmount) {
    throw new Error("Brand token balance delta does not match Agreement amount");
  }
  if (vaultDelta !== totalAmount) {
    throw new Error("Vault token balance delta does not match Agreement amount");
  }

  return {
    status: "CONFIRMED",
    agreementId: input.agreementId,
    escrowId: input.escrowId,
    network: input.network,
    mint: mint.toBase58(),
    programId: programId.toBase58(),
    brandAuthority: brandAuthority.toBase58(),
    creatorDestination: creatorDestination.toBase58(),
    settlementAuthority: settlementAuthority.toBase58(),
    totalAmountBaseUnits: totalAmount.toString(),
    brandTokenAccount: brandTokenAccount.toBase58(),
    escrowPda: escrowPda.toBase58(),
    vaultTokenAccount: vaultTokenAccount.toBase58(),
    signature: input.transactionSignature,
    explorerUrl: `https://explorer.solana.com/tx/${input.transactionSignature}?cluster=${config.solanaCluster}`,
    brandDeltaBaseUnits: brandDelta.toString(),
    vaultDeltaBaseUnits: vaultDelta.toString(),
    slot: tx.slot,
    liveContext: {
      agreementEscrowVersion: "v1",
      escrowId: input.escrowId,
      escrowPda: escrowPda.toBase58(),
      vaultTokenAccount: vaultTokenAccount.toBase58(),
      brandTokenAccount: brandTokenAccount.toBase58(),
      creatorDestination: creatorDestination.toBase58(),
      settlementAuthority: settlementAuthority.toBase58(),
      mint: mint.toBase58(),
      milestoneIds: input.milestoneIds,
      milestoneAmountsBaseUnits: input.milestoneAmountsBaseUnits
    }
  };
}

export async function submitAgreementMilestoneRelease(
  config: GatewayConfig,
  context: AgreementEscrowLiveContext,
  input: { escrowId: string; milestoneId: string; expectedAmountBaseUnits: string }
): Promise<AgreementReleaseReceipt> {
  if (context.agreementEscrowVersion !== "v1") {
    throw new Error("Unsupported Agreement escrow context");
  }
  if (context.escrowId !== input.escrowId) {
    throw new Error("Escrow context does not match requested escrowId");
  }
  const index = context.milestoneIds.indexOf(input.milestoneId);
  if (index < 0) {
    throw new Error(`Unknown milestoneId for live escrow: ${input.milestoneId}`);
  }
  if (context.milestoneAmountsBaseUnits[index] !== input.expectedAmountBaseUnits) {
    throw new Error("Release amount does not match milestone amount");
  }
  const settlement = loadKeypair(
    config.settlementKeypairJson,
    config.settlementKeypairPath,
    "settlement"
  );
  if (settlement.publicKey.toBase58() !== context.settlementAuthority) {
    throw new Error("Settlement keypair public key does not match escrow settlementAuthority");
  }
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const programId = new PublicKey(config.allowedProgramId);
  const mint = new PublicKey(context.mint);
  const escrowPda = new PublicKey(context.escrowPda);
  const vaultTokenAccount = new PublicKey(context.vaultTokenAccount);
  const creatorDestination = new PublicKey(context.creatorDestination);
  const creatorTokenAccount = getAssociatedTokenAddressSync(
    mint,
    creatorDestination,
    false
  );
  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: settlement.publicKey, isSigner: true, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true }
      ],
      data: Buffer.concat([disc("verify_milestone"), Buffer.from([index])])
    }),
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: settlement.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: creatorDestination, isSigner: false, isWritable: false },
        { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: Buffer.concat([disc("release_milestone"), Buffer.from([index])])
    })
  );
  const signature = await sendAndConfirmTransaction(connection, transaction, [settlement], {
    commitment: "confirmed"
  });
  return {
    status: "CONFIRMED",
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${config.solanaCluster}`,
    slot: null
  };
}

export async function prepareAgreementMilestoneRelease(
  config: GatewayConfig,
  body: unknown
): Promise<MilestoneReleasePrepareResult> {
  const input = milestoneReleasePrepareRequestSchema.parse(body);
  validateAllowedConfig(config, input);
  const amount = parseBaseUnits(input.expectedAmountBaseUnits);
  const index = releaseMilestoneIndex(input);

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const programId = new PublicKey(input.programId);
  const mint = new PublicKey(input.mint);
  const settlementAuthority = new PublicKey(input.settlementAuthority);
  const escrowPda = new PublicKey(input.escrowPda);
  const vaultTokenAccount = new PublicKey(input.vaultTokenAccount);
  const creatorDestination = new PublicKey(input.creatorDestination);
  const creatorTokenAccount = getAssociatedTokenAddressSync(
    mint,
    creatorDestination,
    false
  );

  const vaultToken = await getAccount(
    connection,
    vaultTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  if (!vaultToken.owner.equals(escrowPda) || !vaultToken.mint.equals(mint)) {
    throw new Error("Vault token account owner or mint failed validation");
  }
  if (vaultToken.amount < amount) {
    throw new Error("Vault balance is below the milestone release amount");
  }

  const transaction = releaseMilestoneTransaction({
    programId,
    settlementAuthority,
    mint,
    escrowPda,
    vaultTokenAccount,
    creatorDestination,
    creatorTokenAccount,
    index
  });
  const latest = await connection.getLatestBlockhash("confirmed");
  const sponsor = sponsorFeePayer(config, transaction, settlementAuthority, latest.blockhash);
  const fee = await transaction.getEstimatedFee(connection);

  return {
    status: "PREPARED",
    agreementId: input.agreementId,
    escrowId: input.escrowId,
    milestoneId: input.milestoneId,
    network: input.network,
    mint: mint.toBase58(),
    programId: programId.toBase58(),
    feePayer: sponsor.feePayer,
    gasSponsored: sponsor.gasSponsored,
    creatorDestination: creatorDestination.toBase58(),
    settlementAuthority: settlementAuthority.toBase58(),
    expectedAmountBaseUnits: amount.toString(),
    escrowPda: escrowPda.toBase58(),
    vaultTokenAccount: vaultTokenAccount.toBase58(),
    creatorTokenAccount: creatorTokenAccount.toBase58(),
    estimatedNetworkFeeLamports: String(fee ?? 5000),
    transactionBase64: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }).toString("base64"),
    recentBlockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight
  };
}

export async function confirmAgreementMilestoneRelease(
  config: GatewayConfig,
  body: unknown
): Promise<MilestoneReleaseConfirmResult> {
  const input = milestoneReleaseConfirmRequestSchema.parse(body);
  validateAllowedConfig(config, input);
  const amount = parseBaseUnits(input.expectedAmountBaseUnits);
  releaseMilestoneIndex(input);

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const programId = new PublicKey(input.programId);
  const mint = new PublicKey(input.mint);
  const settlementAuthority = new PublicKey(input.settlementAuthority);
  const escrowPda = new PublicKey(input.escrowPda);
  const vaultTokenAccount = new PublicKey(input.vaultTokenAccount);
  const creatorDestination = new PublicKey(input.creatorDestination);
  const creatorTokenAccount = new PublicKey(input.creatorTokenAccount);
  const expectedCreatorToken = getAssociatedTokenAddressSync(mint, creatorDestination, false);
  if (!creatorTokenAccount.equals(expectedCreatorToken)) {
    throw new Error("Creator token account does not match Creator destination");
  }

  const tx = await connection.getParsedTransaction(input.transactionSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0
  });
  if (!tx || tx.meta?.err) {
    throw new Error("Release transaction is not confirmed successfully");
  }
  const signedAccountKeys = tx.transaction.message.accountKeys
    .filter((entry) => entry.signer)
    .map((entry) => entry.pubkey.toBase58());
  if (!signedAccountKeys.includes(settlementAuthority.toBase58())) {
    throw new Error("Release transaction was not signed by the settlement authority");
  }
  const programAccountKeys = tx.transaction.message.accountKeys.map((entry) =>
    entry.pubkey.toBase58()
  );
  if (!programAccountKeys.includes(programId.toBase58())) {
    throw new Error("Release transaction does not invoke the configured escrow program");
  }

  const vaultToken = await getAccount(
    connection,
    vaultTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  const creatorToken = await getAccount(
    connection,
    creatorTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  if (!vaultToken.owner.equals(escrowPda) || !vaultToken.mint.equals(mint)) {
    throw new Error("Vault token account owner or mint failed validation");
  }
  if (!creatorToken.owner.equals(creatorDestination) || !creatorToken.mint.equals(mint)) {
    throw new Error("Creator token account owner or mint failed validation");
  }

  const vaultDelta = tokenDelta(tx, vaultTokenAccount, mint);
  const creatorDelta = tokenDelta(tx, creatorTokenAccount, mint);
  if (vaultDelta !== -amount) {
    throw new Error("Vault token balance delta does not match milestone amount");
  }
  if (creatorDelta !== amount) {
    throw new Error("Creator token balance delta does not match milestone amount");
  }

  return {
    status: "CONFIRMED",
    agreementId: input.agreementId,
    escrowId: input.escrowId,
    milestoneId: input.milestoneId,
    network: input.network,
    mint: mint.toBase58(),
    programId: programId.toBase58(),
    creatorDestination: creatorDestination.toBase58(),
    settlementAuthority: settlementAuthority.toBase58(),
    expectedAmountBaseUnits: amount.toString(),
    escrowPda: escrowPda.toBase58(),
    vaultTokenAccount: vaultTokenAccount.toBase58(),
    creatorTokenAccount: creatorTokenAccount.toBase58(),
    signature: input.transactionSignature,
    explorerUrl: `https://explorer.solana.com/tx/${input.transactionSignature}?cluster=${config.solanaCluster}`,
    vaultDeltaBaseUnits: vaultDelta.toString(),
    creatorDeltaBaseUnits: creatorDelta.toString(),
    slot: tx.slot
  };
}

function validateAllowedConfig(
  config: GatewayConfig,
  input: Pick<FundingPrepareRequest, "mint" | "programId">
) {
  if (input.mint !== config.allowedMint) {
    throw new Error("Requested mint is not allowlisted");
  }
  if (input.programId !== config.allowedProgramId) {
    throw new Error("Requested escrow program is not allowlisted");
  }
}

/**
 * 가스 대납. 릴레이어 키가 설정돼 있으면 feePayer 를 릴레이어로 바꾸고 미리 부분 서명한다.
 * 유저 지갑은 instruction 서명자로만 남으므로 SOL 을 보유할 필요가 없다
 * (Solana 는 feePayer 와 instruction 서명자의 분리를 프로토콜 차원에서 지원한다).
 *
 * 릴레이어가 설정돼 있지 않으면 기존 동작 그대로 유저가 feePayer 가 된다.
 */
function sponsorFeePayer(
  config: GatewayConfig,
  transaction: Transaction,
  fallbackFeePayer: PublicKey,
  recentBlockhash: string
): { feePayer: string; gasSponsored: boolean } {
  transaction.recentBlockhash = recentBlockhash;
  if (!config.relayerKeypairJson && !config.relayerKeypairPath) {
    transaction.feePayer = fallbackFeePayer;
    return { feePayer: fallbackFeePayer.toBase58(), gasSponsored: false };
  }
  const relayer = loadKeypair(config.relayerKeypairJson, config.relayerKeypairPath, "relayer");
  transaction.feePayer = relayer.publicKey;
  // partialSign 은 유저 서명 자리를 비워둔 채 릴레이어 서명만 채운다. 이후 Phantom 이
  // 자기 서명을 더해도 이 서명은 보존된다.
  transaction.partialSign(relayer);
  return { feePayer: relayer.publicKey.toBase58(), gasSponsored: true };
}

function loadKeypair(
  jsonValue: string | undefined,
  filePath: string | undefined,
  label: string
): Keypair {
  if (!jsonValue && !filePath) {
    throw new Error(`${label} keypair is not configured`);
  }
  const raw = jsonValue ?? readFileSync(filePath ?? "", "utf8");
  const secret = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function requireMilestoneSum(
  input: Pick<FundingPrepareRequest, "milestoneIds">,
  milestoneAmounts: bigint[],
  totalAmount: bigint
) {
  if (input.milestoneIds.length !== milestoneAmounts.length) {
    throw new Error("milestoneIds and milestoneAmountsBaseUnits length mismatch");
  }
  const sum = milestoneAmounts.reduce((acc, amount) => acc + amount, 0n);
  if (sum !== totalAmount) {
    throw new Error("Milestone amounts do not sum to Agreement total");
  }
}

function initializeEscrowIx(input: {
  programId: PublicKey;
  brandAuthority: PublicKey;
  creatorDestination: PublicKey;
  settlementAuthority: PublicKey;
  mint: PublicKey;
  agreementHash: Buffer;
  escrowPda: PublicKey;
  vaultTokenAccount: PublicKey;
  milestoneAmounts: bigint[];
  totalAmount: bigint;
  termsHash: string;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.brandAuthority, isSigner: true, isWritable: true },
      { pubkey: input.creatorDestination, isSigner: false, isWritable: false },
      { pubkey: input.settlementAuthority, isSigner: false, isWritable: false },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: input.escrowPda, isSigner: false, isWritable: true },
      { pubkey: input.vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([
      disc("initialize_escrow"),
      input.agreementHash,
      vecU64(input.milestoneAmounts),
      u64(input.totalAmount),
      termsHashBytes(input.termsHash)
    ])
  });
}

function fundEscrowIx(input: {
  programId: PublicKey;
  brandAuthority: PublicKey;
  mint: PublicKey;
  brandTokenAccount: PublicKey;
  escrowPda: PublicKey;
  vaultTokenAccount: PublicKey;
  totalAmount: bigint;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.brandAuthority, isSigner: true, isWritable: true },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: input.brandTokenAccount, isSigner: false, isWritable: true },
      { pubkey: input.escrowPda, isSigner: false, isWritable: true },
      { pubkey: input.vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([disc("fund_escrow"), u64(input.totalAmount)])
  });
}

function releaseMilestoneTransaction(input: {
  programId: PublicKey;
  settlementAuthority: PublicKey;
  mint: PublicKey;
  escrowPda: PublicKey;
  vaultTokenAccount: PublicKey;
  creatorDestination: PublicKey;
  creatorTokenAccount: PublicKey;
  index: number;
}): Transaction {
  return new Transaction().add(
    new TransactionInstruction({
      programId: input.programId,
      keys: [
        { pubkey: input.settlementAuthority, isSigner: true, isWritable: false },
        { pubkey: input.escrowPda, isSigner: false, isWritable: true }
      ],
      data: Buffer.concat([disc("verify_milestone"), Buffer.from([input.index])])
    }),
    new TransactionInstruction({
      programId: input.programId,
      keys: [
        { pubkey: input.settlementAuthority, isSigner: true, isWritable: true },
        { pubkey: input.mint, isSigner: false, isWritable: false },
        { pubkey: input.escrowPda, isSigner: false, isWritable: true },
        { pubkey: input.vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: input.creatorDestination, isSigner: false, isWritable: false },
        { pubkey: input.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: Buffer.concat([disc("release_milestone"), Buffer.from([input.index])])
    })
  );
}

function releaseMilestoneIndex(input: {
  milestoneId: string;
  expectedAmountBaseUnits: string;
  milestoneIds: string[];
  milestoneAmountsBaseUnits: string[];
}): number {
  if (input.milestoneIds.length !== input.milestoneAmountsBaseUnits.length) {
    throw new Error("milestoneIds and milestoneAmountsBaseUnits length mismatch");
  }
  const index = input.milestoneIds.indexOf(input.milestoneId);
  if (index < 0) {
    throw new Error(`Unknown milestoneId for live escrow: ${input.milestoneId}`);
  }
  if (input.milestoneAmountsBaseUnits[index] !== input.expectedAmountBaseUnits) {
    throw new Error("Release amount does not match milestone amount");
  }
  return index;
}

function pda(seeds: Array<string | Buffer>, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    seeds.map((seed) => (typeof seed === "string" ? Buffer.from(seed) : seed)),
    programId
  )[0];
}

function agreementHashBytes(agreementId: string): Buffer {
  return createHash("sha256").update(agreementId).digest();
}

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function vecU64(values: bigint[]): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32LE(values.length);
  return Buffer.concat([length, ...values.map(u64)]);
}

function termsHashBytes(value: string): Buffer {
  const hex = value.startsWith("sha256:") ? value.slice("sha256:".length) : value;
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length !== 32) {
    throw new Error("termsHash must be a sha256-prefixed 32-byte hex digest");
  }
  return bytes;
}

function parseBaseUnits(value: string): bigint {
  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw new Error("Token amount must be positive");
  }
  return parsed;
}

function tokenDelta(
  tx: ParsedTransactionWithMeta,
  account: PublicKey,
  mint: PublicKey
): bigint {
  const keys = tx.transaction.message.accountKeys.map((entry) => entry.pubkey.toBase58());
  const before = tokenBalance(tx.meta?.preTokenBalances ?? [], keys, account, mint);
  const after = tokenBalance(tx.meta?.postTokenBalances ?? [], keys, account, mint);
  return after - before;
}

function tokenBalance(
  balances: TokenBalance[],
  accountKeys: string[],
  account: PublicKey,
  mint: PublicKey
): bigint {
  const accountAddress = account.toBase58();
  const row = balances.find(
    (entry) =>
      accountKeys[entry.accountIndex] === accountAddress && entry.mint === mint.toBase58()
  );
  return row ? BigInt(row.uiTokenAmount.amount) : 0n;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
