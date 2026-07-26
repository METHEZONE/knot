import { z } from "zod";
import type { GatewayConfig } from "./config.js";
import {
  type LiveLockContext,
  submitEscrowLock,
  submitMilestoneRelease
} from "./solana.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const liveLockContextSchema = z.object({
  escrowId: z.string().min(1),
  campaignId: z.string().regex(/^[0-9]+$/),
  campaign: z.string().min(1),
  creator: z.string().min(1),
  creatorToken: z.string().min(1),
  agentAuthority: z.string().min(1),
  treasuryToken: z.string().min(1),
  mint: z.string().min(1),
  milestoneIds: z.array(z.string().min(1)).min(1).max(8),
  milestoneAmountsBaseUnits: z.array(z.string().regex(/^[0-9]+$/)).min(1).max(8)
});

export const lockRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  termsHash: z.string().startsWith("sha256:"),
  expectedAmountBaseUnits: z.string().regex(/^[0-9]+$/),
  milestoneIds: z.array(z.string().min(1)).min(1).max(8).optional(),
  milestoneAmountsBaseUnits: z.array(z.string().regex(/^[0-9]+$/)).min(1).max(8).optional(),
  mint: z.string().min(1),
  programId: z.string().min(1),
  network: z.literal("solanaDevnet"),
  brandAuthority: z.string().min(1),
  creatorDestination: z.string().min(1)
});

export const releaseRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  milestoneId: z.string().min(1),
  termsHash: z.string().startsWith("sha256:"),
  expectedAmountBaseUnits: z.string().regex(/^[0-9]+$/),
  mint: z.string().min(1),
  programId: z.string().min(1),
  network: z.literal("solanaDevnet"),
  creatorDestination: z.string().min(1),
  lockContext: liveLockContextSchema.optional()
});

export type GatewayReceipt = {
  status: "SIMULATED" | "CONFIRMED" | "FAILED";
  agreementId: string;
  escrowId: string;
  milestoneId?: string;
  termsHash: string;
  lockedAmountBaseUnits?: string;
  releasedAmountBaseUnits?: string;
  mint: string;
  programId: string;
  network: "solanaDevnet";
  idempotencyKey: string;
  signature: string | null;
  explorerUrl: string | null;
  slot?: number | null;
  campaignId?: string;
  campaignPda?: string;
  liveContext?: Record<string, JsonValue>;
  };

export type LockResult =
  | { statusCode: 202; body: { data: GatewayReceipt; detail: string } }
  | { statusCode: 200; body: { data: GatewayReceipt; idempotentReplay: true } }
  | { statusCode: 400; body: { code: "VALIDATION_ERROR"; detail: string } }
  | { statusCode: 409; body: { code: "POLICY_VIOLATION"; detail: string } };

export type ReleaseResult = LockResult;

export class EscrowLockService {
  private readonly receipts = new Map<string, GatewayReceipt>();
  private readonly liveLocks = new Map<string, LiveLockContext>();

  async lock(
    config: GatewayConfig,
    idempotencyKey: string | undefined,
    body: unknown
  ): Promise<LockResult> {
    if (!idempotencyKey) {
      return {
        statusCode: 400,
        body: {
          code: "VALIDATION_ERROR",
          detail: "Idempotency-Key header is required"
        }
      };
    }

    const result = lockRequestSchema.safeParse(body);
    if (!result.success) {
      return {
        statusCode: 400,
        body: {
          code: "VALIDATION_ERROR",
          detail: "Invalid escrow lock request"
        }
      };
    }

    const existing = this.receipts.get(idempotencyKey);
    if (existing) {
      return { statusCode: 200, body: { data: existing, idempotentReplay: true } };
    }

    if (result.data.mint !== config.allowedMint || result.data.programId !== config.allowedProgramId) {
      return {
        statusCode: 409,
        body: {
          code: "POLICY_VIOLATION",
          detail: "Mint or programId is not allowed"
        }
      };
    }

    if (BigInt(result.data.expectedAmountBaseUnits) <= 0n) {
      return {
        statusCode: 409,
        body: {
          code: "POLICY_VIOLATION",
          detail: "Lock amount must be positive"
        }
      };
    }
    const milestoneIds = result.data.milestoneIds ?? ["content"];
    const milestoneAmounts = result.data.milestoneAmountsBaseUnits ?? [
      result.data.expectedAmountBaseUnits
    ];
    if (milestoneIds.length !== milestoneAmounts.length) {
      return {
        statusCode: 400,
        body: {
          code: "VALIDATION_ERROR",
          detail: "milestoneIds and milestoneAmountsBaseUnits must have the same length"
        }
      };
    }

    if (config.signingMode === "devnet") {
      try {
        const live = await submitEscrowLock(config, {
          agreementId: result.data.agreementId,
          escrowId: result.data.escrowId,
          termsHash: result.data.termsHash,
          expectedAmountBaseUnits: result.data.expectedAmountBaseUnits,
          milestoneIds,
          milestoneAmountsBaseUnits: milestoneAmounts
        });
        const receipt: GatewayReceipt = {
          status: live.receipt.status,
          agreementId: result.data.agreementId,
          escrowId: result.data.escrowId,
          termsHash: result.data.termsHash,
          lockedAmountBaseUnits: result.data.expectedAmountBaseUnits,
          mint: live.context.mint,
          programId: result.data.programId,
          network: result.data.network,
          idempotencyKey,
          signature: live.receipt.signature,
          explorerUrl: live.receipt.explorerUrl,
          slot: live.receipt.slot,
          campaignId: live.context.campaignId.toString(),
          campaignPda: live.context.campaign,
          liveContext: serializeLiveContext(live.context)
        };
        this.receipts.set(idempotencyKey, receipt);
        this.liveLocks.set(result.data.escrowId, live.context);
        return {
          statusCode: 202,
          body: {
            data: receipt,
            detail: "Escrow lock submitted and confirmed on Solana devnet"
          }
        };
      } catch (error) {
        return {
          statusCode: 409,
          body: {
            code: "POLICY_VIOLATION",
            detail: `Live escrow lock failed: ${error instanceof Error ? error.message : String(error)}`
          }
        };
      }
    }

    const receipt: GatewayReceipt = {
      status: "SIMULATED",
      agreementId: result.data.agreementId,
      escrowId: result.data.escrowId,
      termsHash: result.data.termsHash,
      lockedAmountBaseUnits: result.data.expectedAmountBaseUnits,
      mint: result.data.mint,
      programId: result.data.programId,
      network: result.data.network,
      idempotencyKey,
      signature: null,
      explorerUrl: null
    };
    this.receipts.set(idempotencyKey, receipt);
    return {
      statusCode: 202,
      body: {
        data: receipt,
        detail: "Escrow lock request validated; signing is not implemented in the M3 skeleton"
      }
    };
  }

  async release(
    config: GatewayConfig,
    idempotencyKey: string | undefined,
    escrowId: string,
    milestoneId: string,
    body: unknown
  ): Promise<ReleaseResult> {
    if (!idempotencyKey) {
      return {
        statusCode: 400,
        body: {
          code: "VALIDATION_ERROR",
          detail: "Idempotency-Key header is required"
        }
      };
    }

    const result = releaseRequestSchema.safeParse(body);
    if (!result.success || result.data.escrowId !== escrowId || result.data.milestoneId !== milestoneId) {
      return {
        statusCode: 400,
        body: {
          code: "VALIDATION_ERROR",
          detail: "Invalid milestone release request"
        }
      };
    }

    const existing = this.receipts.get(idempotencyKey);
    if (existing) {
      return { statusCode: 200, body: { data: existing, idempotentReplay: true } };
    }

    if (result.data.mint !== config.allowedMint || result.data.programId !== config.allowedProgramId) {
      return {
        statusCode: 409,
        body: {
          code: "POLICY_VIOLATION",
          detail: "Mint or programId is not allowed"
        }
      };
    }

    if (BigInt(result.data.expectedAmountBaseUnits) <= 0n) {
      return {
        statusCode: 409,
        body: {
          code: "POLICY_VIOLATION",
          detail: "Release amount must be positive"
        }
      };
    }

    if (config.signingMode === "devnet") {
      const context = this.liveLocks.get(escrowId) ?? (
        result.data.lockContext ? parseLiveContext(result.data.lockContext) : undefined
      );
      if (!context) {
        return {
          statusCode: 409,
          body: {
            code: "POLICY_VIOLATION",
            detail: "Live escrow context is not available for this escrowId"
          }
        };
      }
      try {
        const live = await submitMilestoneRelease(config, context, {
          escrowId,
          milestoneId
        });
        const receipt: GatewayReceipt = {
          status: live.status,
          agreementId: result.data.agreementId,
          escrowId: result.data.escrowId,
          milestoneId: result.data.milestoneId,
          termsHash: result.data.termsHash,
          releasedAmountBaseUnits: result.data.expectedAmountBaseUnits,
          mint: result.data.mint,
          programId: result.data.programId,
          network: result.data.network,
          idempotencyKey,
          signature: live.signature,
          explorerUrl: live.explorerUrl,
          slot: live.slot,
          campaignId: context.campaignId.toString(),
          campaignPda: context.campaign
        };
        this.receipts.set(idempotencyKey, receipt);
        return {
          statusCode: 202,
          body: {
            data: receipt,
            detail: "Milestone release submitted and confirmed on Solana devnet"
          }
        };
      } catch (error) {
        return {
          statusCode: 409,
          body: {
            code: "POLICY_VIOLATION",
            detail: `Live milestone release failed: ${error instanceof Error ? error.message : String(error)}`
          }
        };
      }
    }

    const receipt: GatewayReceipt = {
      status: "SIMULATED",
      agreementId: result.data.agreementId,
      escrowId: result.data.escrowId,
      milestoneId: result.data.milestoneId,
      termsHash: result.data.termsHash,
      releasedAmountBaseUnits: result.data.expectedAmountBaseUnits,
      mint: result.data.mint,
      programId: result.data.programId,
      network: result.data.network,
      idempotencyKey,
      signature: null,
      explorerUrl: null
    };
    this.receipts.set(idempotencyKey, receipt);
    return {
      statusCode: 202,
      body: {
        data: receipt,
        detail: "Milestone release request validated; signing is not implemented yet"
      }
    };
  }
}

function serializeLiveContext(context: LiveLockContext): Record<string, JsonValue> {
  return {
    escrowId: context.escrowId,
    campaignId: context.campaignId.toString(),
    campaign: context.campaign,
    creator: context.creator,
    creatorToken: context.creatorToken,
    agentAuthority: context.agentAuthority,
    treasuryToken: context.treasuryToken,
    mint: context.mint,
    milestoneIds: context.milestoneIds,
    milestoneAmountsBaseUnits: context.milestoneAmountsBaseUnits
  };
}

function parseLiveContext(context: z.infer<typeof liveLockContextSchema>): LiveLockContext {
  return {
    escrowId: context.escrowId,
    campaignId: BigInt(context.campaignId),
    campaign: context.campaign,
    creator: context.creator,
    creatorToken: context.creatorToken,
    agentAuthority: context.agentAuthority,
    treasuryToken: context.treasuryToken,
    mint: context.mint,
    milestoneIds: context.milestoneIds,
    milestoneAmountsBaseUnits: context.milestoneAmountsBaseUnits
  };
}
