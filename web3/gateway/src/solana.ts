import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";
import type { GatewayConfig } from "./config.js";

type LockInput = {
  agreementId: string;
  escrowId: string;
  termsHash: string;
  expectedAmountBaseUnits: string;
  brandAuthority: string;
  creatorDestination: string;
  agentId?: string;
  milestoneIds: string[];
  milestoneAmountsBaseUnits: string[];
};

type ReleaseInput = {
  escrowId: string;
  milestoneId: string;
  creatorDestination?: string;
};

export type LiveLockContext = {
  escrowId: string;
  campaignId: bigint;
  campaign: string;
  brand?: string;
  creator: string;
  creatorDestination?: string;
  creatorToken: string;
  agentAuthority: string;
  treasuryToken: string;
  mint: string;
  agentId?: string;
  milestoneIds: string[];
  milestoneAmountsBaseUnits: string[];
};

export type LiveTransactionReceipt = {
  status: "CONFIRMED";
  signature: string;
  explorerUrl: string;
  slot: null;
};

const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
const MIN_AGENT_SOL_LAMPORTS = 30_000_000;

export async function submitEscrowLock(
  config: GatewayConfig,
  input: LockInput
): Promise<{ receipt: LiveTransactionReceipt; context: LiveLockContext }> {
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const brand =
    config.autoMintOnLock || config.autoSolTopupOnLock
      ? loadKeypair(config.brandKeypairJson, config.brandKeypairPath, "brand")
      : undefined;
  const brandAuthority = new PublicKey(input.brandAuthority);
  const creatorDestination = new PublicKey(input.creatorDestination);
  const agent = await loadAgentKeypair(config, input.agentId);
  const programId = new PublicKey(config.allowedProgramId);
  const configPda = pda(["config"], programId);
  const allowedMint = new PublicKey(config.allowedMint);

  let mint: PublicKey;
  let treasuryToken: PublicKey;
  let brandFeeBps = 0;
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    throw new Error("Escrow config PDA is not initialized for this program");
  }
  treasuryToken = new PublicKey(configInfo.data.subarray(40, 72));
  const treasury = await getAccount(connection, treasuryToken, "confirmed", TOKEN_PROGRAM_ID);
  mint = treasury.mint;
  if (!mint.equals(allowedMint)) {
    throw new Error(`Escrow config mint ${mint.toBase58()} does not match allowed mint`);
  }
  brandFeeBps = configInfo.data.readUInt16LE(72);

  const milestoneAmounts = input.milestoneAmountsBaseUnits.map((value) => BigInt(value));
  const total = milestoneAmounts.reduce((sum, amount) => sum + amount, 0n);
  const brandFeeTotal = milestoneAmounts.reduce(
    (sum, amount) => sum + applyBps(amount, brandFeeBps),
    0n
  );
  const deposit = total + brandFeeTotal;

  // funder = agent: 에이전트 토큰계정에 예산 확보(로컬넷은 자체 민팅; 공유망은 이미 충전된 잔고 필요)
  // 에이전트 지갑은 딜마다 재사용되므로 반드시 멱등하게 확보해야 한다 —
  // createAccount 는 이미 존재하면 "Provided owner is not allowed" 로 실패해서 두 번째 락이 깨졌다.
  const agentToken = (
    await getOrCreateAssociatedTokenAccount(connection, agent, mint, agent.publicKey)
  ).address;
  if (config.autoMintOnLock) {
    if (!brand) {
      throw new Error("brand keypair is required for localnet auto mint");
    }
    await mintTo(connection, brand, mint, agentToken, brand, deposit);
  } else {
    const account = await getAccount(connection, agentToken, "confirmed", TOKEN_PROGRAM_ID);
    if (account.amount < deposit) {
      throw new Error(
        `Agent wallet has insufficient token balance for escrow lock: required ${deposit}, available ${account.amount}`
      );
    }
  }
  if (config.autoSolTopupOnLock) {
    if (!brand) {
      throw new Error("brand keypair is required for localnet SOL top-up");
    }
    await sendIx(
      connection,
      SystemProgram.transfer({
        fromPubkey: brand.publicKey,
        toPubkey: agent.publicKey,
        lamports: MIN_AGENT_SOL_LAMPORTS
      }),
      [brand]
    );
  } else {
    const agentSol = await connection.getBalance(agent.publicKey, "confirmed");
    if (agentSol < MIN_AGENT_SOL_LAMPORTS) {
      throw new Error(
        `Agent wallet has insufficient SOL for escrow lock: required ${MIN_AGENT_SOL_LAMPORTS}, available ${agentSol}`
      );
    }
  }

  const campaignId = campaignIdFromEscrowId(input.escrowId);
  const campaign = pda(["campaign", brandAuthority.toBuffer(), u64(campaignId)], programId);
  const vaultAuthority = pda(["vault-auth", campaign.toBuffer()], programId);
  const vault = pda(["vault", campaign.toBuffer()], programId);
  const signature = await sendIx(
    connection,
    initializeCampaignIx({
      programId,
      brand: brandAuthority,
      creator: creatorDestination,
      agentAuthority: agent.publicKey,
      funder: agent.publicKey,
      mint,
      funderToken: agentToken,
      config: configPda,
      campaign,
      vaultAuthority,
      vault,
      campaignId,
      milestoneAmounts,
      autoApproveCap: BigInt(input.expectedAmountBaseUnits),
      termsHash: input.termsHash
    }),
    [agent]
  );

  return {
    receipt: liveReceipt(config, signature),
    context: {
      escrowId: input.escrowId,
      campaignId,
      campaign: campaign.toBase58(),
      brand: brandAuthority.toBase58(),
      creator: creatorDestination.toBase58(),
      creatorDestination: creatorDestination.toBase58(),
      creatorToken: (
        await getOrCreateAssociatedTokenAccount(connection, agent, mint, creatorDestination)
      ).address.toBase58(),
      agentAuthority: agent.publicKey.toBase58(),
      treasuryToken: treasuryToken.toBase58(),
      mint: mint.toBase58(),
      agentId: input.agentId,
      milestoneIds: input.milestoneIds,
      milestoneAmountsBaseUnits: input.milestoneAmountsBaseUnits
    }
  };
}

export async function submitMilestoneRelease(
  config: GatewayConfig,
  context: LiveLockContext,
  input: ReleaseInput
): Promise<LiveTransactionReceipt> {
  const index = context.milestoneIds.indexOf(input.milestoneId);
  if (index < 0) {
    throw new Error(`Unknown milestoneId for live escrow: ${input.milestoneId}`);
  }
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const agent = await loadAgentKeypair(config, context.agentId);
  if (
    input.creatorDestination &&
    context.creatorDestination &&
    context.creatorDestination !== input.creatorDestination
  ) {
    throw new Error("Release creatorDestination does not match locked escrow context");
  }
  const programId = new PublicKey(config.allowedProgramId);
  const campaign = new PublicKey(context.campaign);
  const vaultAuthority = pda(["vault-auth", campaign.toBuffer()], programId);
  const vault = pda(["vault", campaign.toBuffer()], programId);
  const creator = new PublicKey(context.creator);
  const reputation = pda(["rep", creator.toBuffer()], programId);
  const signature = await sendIx(
    connection,
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: agent.publicKey, isSigner: true, isWritable: true },
        { pubkey: campaign, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(context.creatorToken), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(context.treasuryToken), isSigner: false, isWritable: true },
        { pubkey: reputation, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      data: Buffer.concat([disc("approve_and_release"), Buffer.from([index])])
    }),
    [agent]
  );
  return liveReceipt(config, signature);
}

function loadKeypair(jsonValue: string | undefined, filePath: string | undefined, label: string): Keypair {
  if (!jsonValue && !filePath) {
    throw new Error(`${label} keypair is not configured`);
  }
  const raw = jsonValue ?? readFileSync(filePath ?? "", "utf8");
  const secret = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

// per-agent 키: agentId + gcpProjectId 있으면 Secret Manager(knot-agent-key-{agentId})에서 로드,
// 없으면 config의 고정 agent 키로 폴백. (백엔드 provision과 동일한 number[] JSON 포맷)
async function loadAgentKeypair(config: GatewayConfig, agentId?: string): Promise<Keypair> {
  if (config.agentKeypairJson || config.agentKeypairPath) {
    return loadKeypair(config.agentKeypairJson, config.agentKeypairPath, "agent");
  }
  if (agentId && config.gcpProjectId) {
    const secret = await fetchAgentSecret(config.gcpProjectId, agentId);
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  return loadKeypair(config.agentKeypairJson, config.agentKeypairPath, "agent");
}

async function fetchAgentSecret(projectId: string, agentId: string): Promise<number[]> {
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();
  const name = `projects/${projectId}/secrets/knot-agent-key-${agentId}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString() ?? "[]";
  return JSON.parse(payload) as number[];
}

async function sendIx(
  connection: Connection,
  instruction: TransactionInstruction,
  signers: Keypair[]
): Promise<string> {
  const transaction = new Transaction().add(instruction);
  return sendAndConfirmTransaction(connection, transaction, signers, { commitment: "confirmed" });
}

function initializeCampaignIx(input: {
  programId: PublicKey;
  brand: PublicKey;
  creator: PublicKey;
  agentAuthority: PublicKey;
  funder: PublicKey;
  mint: PublicKey;
  funderToken: PublicKey;
  config: PublicKey;
  campaign: PublicKey;
  vaultAuthority: PublicKey;
  vault: PublicKey;
  campaignId: bigint;
  milestoneAmounts: bigint[];
  autoApproveCap: bigint;
  termsHash: string;
}): TransactionInstruction {
  // funder 모델(agent-funded): brand는 비서명 pubkey, funder(=agent)가 서명·펀딩.
  return new TransactionInstruction({
    programId: input.programId,
    keys: [
      { pubkey: input.brand, isSigner: false, isWritable: false },
      { pubkey: input.creator, isSigner: false, isWritable: false },
      { pubkey: input.agentAuthority, isSigner: false, isWritable: false },
      { pubkey: input.funder, isSigner: true, isWritable: true },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: input.funderToken, isSigner: false, isWritable: true },
      { pubkey: input.config, isSigner: false, isWritable: false },
      { pubkey: input.campaign, isSigner: false, isWritable: true },
      { pubkey: input.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: input.vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([
      disc("initialize_campaign"),
      u64(input.campaignId),
      vecU64(input.milestoneAmounts),
      u64(input.autoApproveCap),
      termsHashBytes(input.termsHash),
      i64(3600n)
    ])
  });
}

function pda(seeds: Array<string | Buffer>, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    seeds.map((seed) => (typeof seed === "string" ? Buffer.from(seed) : seed)),
    programId
  )[0];
}

function campaignIdFromEscrowId(escrowId: string): bigint {
  return createHash("sha256").update(escrowId).digest().readBigUInt64LE(0);
}

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
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

function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10_000n;
}

function liveReceipt(config: GatewayConfig, signature: string): LiveTransactionReceipt {
  return {
    status: "CONFIRMED",
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${config.solanaCluster}`,
    slot: null
  };
}
