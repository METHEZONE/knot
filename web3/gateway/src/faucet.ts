import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { GatewayConfig } from "./config.js";

export const airdropRequestSchema = z.object({
  address: z.string().min(32).max(64),
  sol: z.number().positive().max(1000).optional(),
  usdc: z.number().nonnegative().max(1_000_000).optional()
});

export type AirdropResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

/**
 * 로컬 밸리데이터에서만 도는 faucet. 사람이 Phantom 을 연결하면 그 주소에 SOL 을 채워
 * 로컬 데모에서 바로 서명·수수료를 낼 수 있게 한다.
 *
 * devnet/mainnet 에서는 절대 동작하지 않는다 — RPC 가 루프백이 아니면 즉시 거부한다.
 * (devnet faucet 은 rate limit 이 있고, 실 자금 흐름을 흉내내면 데모가 거짓이 된다)
 */
export function isLoopbackRpc(rpcUrl: string): boolean {
  try {
    const host = new URL(rpcUrl).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "0.0.0.0";
  } catch {
    return false;
  }
}

export async function airdrop(config: GatewayConfig, body: unknown): Promise<AirdropResult> {
  if (!isLoopbackRpc(config.solanaRpcUrl)) {
    return {
      statusCode: 403,
      body: {
        code: "FAUCET_DISABLED",
        detail: "Faucet is only available against a local validator."
      }
    };
  }
  const parsed = airdropRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { statusCode: 400, body: { code: "VALIDATION_ERROR", detail: "Invalid airdrop request" } };
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(parsed.data.address);
  } catch {
    return { statusCode: 400, body: { code: "VALIDATION_ERROR", detail: "Invalid Solana address" } };
  }

  const targetSol = parsed.data.sol ?? 100;
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  try {
    const before = await connection.getBalance(pubkey, "confirmed");
    const targetLamports = Math.round(targetSol * LAMPORTS_PER_SOL);
    // 이미 목표치를 넘겼으면 다시 주지 않는다 — 재연결마다 잔액이 불어나면 데모 숫자가 흔들린다.
    if (before >= targetLamports) {
      return {
        statusCode: 200,
        body: {
          address: parsed.data.address,
          skipped: true,
          balanceSol: before / LAMPORTS_PER_SOL,
          detail: "Balance already at or above the requested amount."
        }
      };
    }
    const signature = await connection.requestAirdrop(pubkey, targetLamports - before);
    const blockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature, ...blockhash }, "confirmed");
    const after = await connection.getBalance(pubkey, "confirmed");

    // 유저 지갑이 딜 서명 시 에스크로에 직접 예치하려면 USDC 도 필요하다.
    // 로컬 mint 의 발행 권한은 brand 키페어(=밸리데이터 payer)라 여기서 찍어줄 수 있다.
    const usdcAmount = parsed.data.usdc ?? 0;
    let usdcMinted: number | null = null;
    if (usdcAmount > 0) {
      usdcMinted = await mintTestUsdc(config, connection, pubkey, usdcAmount);
    }

    return {
      statusCode: 200,
      body: {
        address: parsed.data.address,
        skipped: false,
        signature,
        balanceSol: after / LAMPORTS_PER_SOL,
        usdcMinted,
        cluster: config.solanaCluster
      }
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        code: "FAUCET_FAILED",
        detail: `Airdrop failed: ${error instanceof Error ? error.message : String(error)}`
      }
    };
  }
}

/** 로컬 mint(발행 권한 = brand 키페어)에서 테스트 USDC 를 지갑 ATA 로 찍는다. 반환값은 찍은 수량. */
async function mintTestUsdc(
  config: GatewayConfig,
  connection: Connection,
  owner: PublicKey,
  amount: number
): Promise<number> {
  const raw = config.brandKeypairJson ?? readFileSync(config.brandKeypairPath ?? "", "utf8");
  const brand = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  const mint = new PublicKey(config.allowedMint);
  const account = await getOrCreateAssociatedTokenAccount(connection, brand, mint, owner);
  // 데모 mint 는 6 decimals (USDC-SPL 과 동일)
  await mintTo(connection, brand, mint, account.address, brand, BigInt(Math.round(amount * 1_000_000)));
  return amount;
}
