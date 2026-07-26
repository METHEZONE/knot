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
    brandKeypairJson: env.KNOT_BRAND_KEYPAIR_JSON
  };
}
