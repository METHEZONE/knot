import { z } from "zod";
import type { GatewayConfig } from "./config.js";

export const lockRequestSchema = z.object({
  agreementId: z.string().min(1),
  escrowId: z.string().min(1),
  termsHash: z.string().startsWith("sha256:"),
  expectedAmountBaseUnits: z.string().regex(/^[0-9]+$/),
  mint: z.string().min(1),
  programId: z.string().min(1),
  network: z.literal("solanaDevnet"),
  brandAuthority: z.string().min(1),
  creatorDestination: z.string().min(1)
});

export type LockReceipt = {
  status: "SIMULATED";
  agreementId: string;
  escrowId: string;
  termsHash: string;
  lockedAmountBaseUnits: string;
  mint: string;
  programId: string;
  network: "solanaDevnet";
  idempotencyKey: string;
  signature: null;
  explorerUrl: null;
};

export type LockResult =
  | { statusCode: 202; body: { data: LockReceipt; detail: string } }
  | { statusCode: 200; body: { data: LockReceipt; idempotentReplay: true } }
  | { statusCode: 400; body: { code: "VALIDATION_ERROR"; detail: string } }
  | { statusCode: 409; body: { code: "POLICY_VIOLATION"; detail: string } };

export class EscrowLockService {
  private readonly receipts = new Map<string, LockReceipt>();

  lock(config: GatewayConfig, idempotencyKey: string | undefined, body: unknown): LockResult {
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

    const receipt: LockReceipt = {
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
}
