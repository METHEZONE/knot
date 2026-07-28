import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import type { GatewayConfig } from "./config.js";

export type BalanceResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

/**
 * 지갑의 SOL / USDC-SPL 잔고 조회. 읽기 전용이라 클러스터 제한이 없다.
 * 토큰계정이 아직 없으면 잔고 0 으로 보고한다(에러가 아니다 — 한 번도 받은 적 없는 지갑).
 */
export async function walletBalance(config: GatewayConfig, address: string): Promise<BalanceResult> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(address);
  } catch {
    return { statusCode: 400, body: { code: "VALIDATION_ERROR", detail: "Invalid Solana address" } };
  }

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const mint = new PublicKey(config.allowedMint);
  try {
    const lamports = await connection.getBalance(owner, "confirmed");
    let usdc = 0;
    try {
      const ata = await getAssociatedTokenAddress(mint, owner);
      const account = await getAccount(connection, ata, "confirmed");
      usdc = Number(account.amount) / 1_000_000; // USDC-SPL = 6 decimals
    } catch {
      usdc = 0;
    }
    return {
      statusCode: 200,
      body: {
        address,
        sol: lamports / LAMPORTS_PER_SOL,
        usdc,
        mint: config.allowedMint,
        cluster: config.solanaCluster
      }
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        code: "BALANCE_UNAVAILABLE",
        detail: `Balance lookup failed: ${error instanceof Error ? error.message : String(error)}`
      }
    };
  }
}
