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
  settlementKeypairPath?: string;
  settlementKeypairJson?: string;
  // 가스 대납 릴레이어. 설정되면 유저가 서명하는 tx의 feePayer 를 이 지갑으로 바꾸고
  // 게이트웨이가 미리 부분 서명한다 → 유저는 SOL 을 보유할 필요가 없다.
  relayerKeypairPath?: string;
  relayerKeypairJson?: string;
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
    allowedProgramId: env.KNOT_ESCROW_PROGRAM_ID ?? "9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn",
    signingMode: env.KNOT_WEB3_SIGNING_MODE === "devnet" ? "devnet" : "simulated",
    brandKeypairPath: env.KNOT_BRAND_KEYPAIR_PATH || env.ANCHOR_WALLET,
    brandKeypairJson: env.KNOT_BRAND_KEYPAIR_JSON,
    creatorKeypairPath: env.KNOT_CREATOR_KEYPAIR_PATH,
    creatorKeypairJson: env.KNOT_CREATOR_KEYPAIR_JSON,
    agentKeypairPath: env.KNOT_AGENT_KEYPAIR_PATH,
    agentKeypairJson: env.KNOT_AGENT_KEYPAIR_JSON,
    settlementKeypairPath: env.KNOT_SETTLEMENT_KEYPAIR_PATH || env.KNOT_AGENT_KEYPAIR_PATH,
    settlementKeypairJson: env.KNOT_SETTLEMENT_KEYPAIR_JSON || env.KNOT_AGENT_KEYPAIR_JSON,
    relayerKeypairPath: env.KNOT_RELAYER_KEYPAIR_PATH,
    relayerKeypairJson: env.KNOT_RELAYER_KEYPAIR_JSON
  };
}
