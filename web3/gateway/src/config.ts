export type GatewayConfig = {
  serviceName: string;
  gitSha: string;
  buildTime: string;
  schemaVersion: string;
  solanaCluster: string;
  solanaRpcUrl: string;
  allowedMint: string;
  allowedProgramId: string;
  signingMode: "simulated" | "devnet";
  brandKeypairPath?: string;
  brandKeypairJson?: string;
  creatorKeypairPath?: string;
  creatorKeypairJson?: string;
  agentKeypairPath?: string;
  agentKeypairJson?: string;
  gcpProjectId?: string;
  autoMintOnLock: boolean;
  autoSolTopupOnLock: boolean;
  settlementKeypairPath?: string;
  settlementKeypairJson?: string;
  // 가스 대납 릴레이어. 설정되면 유저가 서명하는 tx의 feePayer 를 이 지갑으로 바꾸고
  // 게이트웨이가 미리 부분 서명한다 → 유저는 SOL 을 보유할 필요가 없다.
  relayerKeypairPath?: string;
  relayerKeypairJson?: string;
  /** 중개 수수료 수취 주소. 지출하지 않는 수취 전용 지갑 (docs/17 D4). */
  platformTreasury?: string;
  /** 협상된 중개 수수료율. 온체인 상한 MAX_AGREEMENT_FEE_BPS(1000) 이내. */
  feeBps: number;
  /** 환불 타임락 초. 온체인 하한 MIN_REFUND_TIMELOCK_SECS(86400) 이상. */
  refundTimelockSecs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    serviceName: env.KNOT_SERVICE_NAME ?? "knot-web3",
    gitSha: env.GIT_SHA ?? "local",
    buildTime: env.BUILD_TIME ?? "local",
    schemaVersion: "v1",
    solanaCluster: env.SOLANA_CLUSTER ?? "devnet",
    solanaRpcUrl: env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    // Defaults match the real devnet knot-escrow program and USDC-SPL mint
    // (programs/knot-escrow, backend/.env.example, libs/settings/config.py).
    allowedMint: env.KNOT_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    allowedProgramId: env.KNOT_ESCROW_PROGRAM_ID ?? "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj",
    signingMode: env.KNOT_WEB3_SIGNING_MODE === "devnet" ? "devnet" : "simulated",
    brandKeypairPath: env.KNOT_BRAND_KEYPAIR_PATH || env.ANCHOR_WALLET,
    brandKeypairJson: env.KNOT_BRAND_KEYPAIR_JSON,
    creatorKeypairPath: env.KNOT_CREATOR_KEYPAIR_PATH,
    creatorKeypairJson: env.KNOT_CREATOR_KEYPAIR_JSON,
    agentKeypairPath: env.KNOT_AGENT_KEYPAIR_PATH,
    agentKeypairJson: env.KNOT_AGENT_KEYPAIR_JSON,
    gcpProjectId: env.GOOGLE_CLOUD_PROJECT ?? env.GCP_PROJECT_ID,
    autoMintOnLock: autoLocalnetOnly(
      env.KNOT_WEB3_AUTO_MINT_ON_LOCK,
      env.SOLANA_CLUSTER ?? "devnet"
    ),
    autoSolTopupOnLock: autoLocalnetOnly(
      env.KNOT_WEB3_AUTO_SOL_TOPUP_ON_LOCK,
      env.SOLANA_CLUSTER ?? "devnet"
    ),
    settlementKeypairPath: env.KNOT_SETTLEMENT_KEYPAIR_PATH || env.KNOT_AGENT_KEYPAIR_PATH,
    settlementKeypairJson: env.KNOT_SETTLEMENT_KEYPAIR_JSON || env.KNOT_AGENT_KEYPAIR_JSON,
    relayerKeypairPath: env.KNOT_RELAYER_KEYPAIR_PATH,
    relayerKeypairJson: env.KNOT_RELAYER_KEYPAIR_JSON,
    platformTreasury: env.KNOT_PLATFORM_TREASURY,
    // N2: 중개 수수료 5%, 브랜드 부담 (docs/17). 0 이면 수수료 없이 동작한다.
    feeBps: intFromEnv(env.KNOT_ESCROW_FEE_BPS, 500),
    // N4: 콘텐츠 마감 + 7일. 온체인 하한이 1일이므로 그 아래로는 프로그램이 거부한다.
    refundTimelockSecs: intFromEnv(env.KNOT_REFUND_TIMELOCK_SECS, 7 * 24 * 60 * 60)
  };
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function autoLocalnetOnly(value: string | undefined, cluster: string): boolean {
  if (value !== undefined) {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }
  return cluster === "localnet";
}
