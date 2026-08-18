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
  rpcUrl: string;
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
  rpcUrl: string;
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
  // N2: 수수료는 브랜드 부담이라 예치액 = 협상액 + 수수료다. 크리에이터는 협상액을 그대로
  // 받는다. 수수료는 마일스톤별로 계산해 합산해야 릴리즈 시점 합과 반올림까지 일치한다
  // (프로그램의 initialize_escrow 와 같은 방식).
  const feeBps = config.feeBps;
  const feeTotal = milestoneAmounts.reduce(
    (acc, amount) => acc + applyBps(amount, feeBps),
    0n
  );
  const requiredFunding = totalAmount + feeTotal;
  if (brandToken.amount < requiredFunding) {
    throw new Error(
      "Brand USDC balance is below the Agreement total amount plus the platform fee"
    );
  }
  const platformTreasury = new PublicKey(
    config.platformTreasury ?? settlementAuthority.toBase58()
  );

  const transaction = new Transaction();
  transaction.add(
    initializeEscrowIx({
      programId,
      brandAuthority,
      creatorDestination,
      settlementAuthority,
      platformTreasury,
      mint,
      agreementHash,
      escrowPda,
      vaultTokenAccount,
      milestoneAmounts,
      totalAmount,
      termsHash: input.termsHash,
      feeBps,
      refundTimelockSecs: BigInt(config.refundTimelockSecs)
    }),
    fundEscrowIx({
      programId,
      brandAuthority,
      mint,
      brandTokenAccount,
      escrowPda,
      vaultTokenAccount,
      totalAmount: requiredFunding
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
    lastValidBlockHeight: latest.lastValidBlockHeight,
    rpcUrl: config.solanaRpcUrl
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

const refundApprovalPrepareRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  escrowPda: z.string().min(1),
  brandAuthority: z.string().min(1),
  programId: z.string().min(1),
  network: z.string().min(1)
});

export type RefundApprovalPrepareResult = {
  status: "PREPARED";
  agreementId: string;
  escrowId: string;
  escrowPda: string;
  brandAuthority: string;
  feePayer: string;
  gasSponsored: boolean;
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  rpcUrl: string;
};

/**
 * 브랜드가 서명할 환불 승인 tx 를 만든다 (docs/17 P0 빠른 경로).
 *
 * 자금을 이동시키지 않는다 — 플래그만 켠다. 실제 환불은 settlement_authority 가 실행한다.
 */
export async function prepareEscrowRefundApproval(
  config: GatewayConfig,
  body: unknown
): Promise<RefundApprovalPrepareResult> {
  const input = refundApprovalPrepareRequestSchema.parse(body);
  if (input.programId !== config.allowedProgramId) {
    throw new Error("programId is not allowlisted for this gateway");
  }
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const brandAuthority = new PublicKey(input.brandAuthority);
  const transaction = new Transaction().add(
    approveRefundIx({
      programId: new PublicKey(input.programId),
      brandAuthority,
      escrowPda: new PublicKey(input.escrowPda)
    })
  );
  const latest = await connection.getLatestBlockhash("confirmed");
  const sponsor = sponsorFeePayer(config, transaction, brandAuthority, latest.blockhash);
  return {
    status: "PREPARED",
    agreementId: input.agreementId,
    escrowId: input.escrowId,
    escrowPda: input.escrowPda,
    brandAuthority: brandAuthority.toBase58(),
    feePayer: sponsor.feePayer,
    gasSponsored: sponsor.gasSponsored,
    transactionBase64: transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    recentBlockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    rpcUrl: config.solanaRpcUrl
  };
}

/**
 * 미지급 잔액을 브랜드 지갑으로 환불한다 (docs/17 D2).
 *
 * settlement_authority 가 서명하지만 온체인 선행조건(브랜드 승인 또는 타임락 경과)을
 * 만족하지 않으면 프로그램이 거부한다. 즉 플랫폼이 임의로 환불할 수 없다.
 */
export async function submitAgreementRefund(
  config: GatewayConfig,
  context: AgreementEscrowLiveContext,
  input: { escrowId: string; brandTokenAccount: string }
): Promise<AgreementReleaseReceipt> {
  if (context.agreementEscrowVersion !== "v1") {
    throw new Error("Unsupported Agreement escrow context");
  }
  if (context.escrowId !== input.escrowId) {
    throw new Error("Escrow context does not match requested escrowId");
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
  const transaction = new Transaction().add(
    refundRemainingIx({
      programId: new PublicKey(config.allowedProgramId),
      settlementAuthority: settlement.publicKey,
      mint: new PublicKey(context.mint),
      escrowPda: new PublicKey(context.escrowPda),
      vaultTokenAccount: new PublicKey(context.vaultTokenAccount),
      brandTokenAccount: new PublicKey(input.brandTokenAccount)
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
  const platformTreasury = new PublicKey(
    config.platformTreasury ?? settlement.publicKey.toBase58()
  );
  const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, platformTreasury, true);
  const transaction = releaseMilestoneTransaction({
    programId,
    settlementAuthority: settlement.publicKey,
    mint,
    escrowPda,
    vaultTokenAccount,
    creatorDestination,
    creatorTokenAccount,
    platformTreasury,
    treasuryTokenAccount,
    index
  });
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

  // 트레저리 주소가 설정되지 않았으면 정산 키를 수취처로 쓴다 — 프로그램이 저장된 주소와
  // 대조하므로 init 시점과 동일해야 한다.
  const platformTreasury = new PublicKey(
    config.platformTreasury ?? settlementAuthority.toBase58()
  );
  const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, platformTreasury, true);
  const transaction = releaseMilestoneTransaction({
    programId,
    settlementAuthority,
    mint,
    escrowPda,
    vaultTokenAccount,
    creatorDestination,
    creatorTokenAccount,
    platformTreasury,
    treasuryTokenAccount,
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
    lastValidBlockHeight: latest.lastValidBlockHeight,
    rpcUrl: config.solanaRpcUrl
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
  platformTreasury: PublicKey;
  mint: PublicKey;
  agreementHash: Buffer;
  escrowPda: PublicKey;
  vaultTokenAccount: PublicKey;
  milestoneAmounts: bigint[];
  totalAmount: bigint;
  termsHash: string;
  feeBps: number;
  refundTimelockSecs: bigint;
}): TransactionInstruction {
  // 계정 순서는 Rust 의 InitializeEscrow 필드 순서와 정확히 같아야 한다.
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.brandAuthority, isSigner: true, isWritable: true },
      { pubkey: input.creatorDestination, isSigner: false, isWritable: false },
      { pubkey: input.settlementAuthority, isSigner: false, isWritable: false },
      { pubkey: input.platformTreasury, isSigner: false, isWritable: false },
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
      termsHashBytes(input.termsHash),
      u16(input.feeBps),
      i64(input.refundTimelockSecs)
    ])
  });
}

/** 브랜드가 환불을 명시 승인한다. 자금을 이동시키지 않는다. */
function approveRefundIx(input: {
  programId: PublicKey;
  brandAuthority: PublicKey;
  escrowPda: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.brandAuthority, isSigner: true, isWritable: false },
      { pubkey: input.escrowPda, isSigner: false, isWritable: true }
    ],
    data: disc("approve_refund")
  });
}

/**
 * 미지급 잔액을 브랜드 지갑으로 환불한다.
 *
 * 서명자가 settlement_authority 다 — 브랜드 키가 아니다. 온체인 선행조건(브랜드 승인 또는
 * 타임락 경과)이 플랫폼의 임의 환불을 막는다.
 */
function refundRemainingIx(input: {
  programId: PublicKey;
  settlementAuthority: PublicKey;
  mint: PublicKey;
  escrowPda: PublicKey;
  vaultTokenAccount: PublicKey;
  brandTokenAccount: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.settlementAuthority, isSigner: true, isWritable: true },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: input.escrowPda, isSigner: false, isWritable: true },
      { pubkey: input.vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: input.brandTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data: disc("refund_remaining")
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
  platformTreasury: PublicKey;
  treasuryTokenAccount: PublicKey;
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
        { pubkey: input.platformTreasury, isSigner: false, isWritable: false },
        { pubkey: input.treasuryTokenAccount, isSigner: false, isWritable: true },
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

/** 프로그램의 apply_bps 와 같은 계산 (floor). 어긋나면 예치액이 부족해 릴리즈가 실패한다. */
function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10_000n;
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function i64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value);
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
