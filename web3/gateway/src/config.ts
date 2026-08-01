export type GatewayConfig = {
  serviceName: string;
  gitSha: string;
  buildTime: string;
  schemaVersion: string;
  solanaCluster: string;
  solanaRpcUrl: string;
  allowedMint: string;
  allowedProgramId: string;
  signingMode: "simulated" | "live";
  brandKeypairPath?: string;
  brandKeypairJson?: string;
  creatorKeypairPath?: string;
  creatorKeypairJson?: string;
  agentKeypairPath?: string;
  agentKeypairJson?: string;
  gcpProjectId?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const cluster = env.SOLANA_CLUSTER ?? "testnet";
  return {
    serviceName: env.KNOT_SERVICE_NAME ?? "knot-web3",
    gitSha: env.GIT_SHA ?? "local",
    buildTime: env.BUILD_TIME ?? "local",
    schemaVersion: "v1",
    solanaCluster: cluster,
    solanaRpcUrl: env.SOLANA_RPC_URL ?? defaultRpcUrl(cluster),
    // Live shared deployments must override both values for the selected
    // cluster. These defaults only keep local/unit test configuration stable.
    allowedMint: env.KNOT_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    allowedProgramId: env.KNOT_ESCROW_PROGRAM_ID ?? "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj",
    signingMode: liveSigningRequested(env.KNOT_WEB3_SIGNING_MODE) ? "live" : "simulated",
    brandKeypairPath: env.KNOT_BRAND_KEYPAIR_PATH || env.ANCHOR_WALLET,
    brandKeypairJson: env.KNOT_BRAND_KEYPAIR_JSON,
    creatorKeypairPath: env.KNOT_CREATOR_KEYPAIR_PATH,
    creatorKeypairJson: env.KNOT_CREATOR_KEYPAIR_JSON,
    agentKeypairPath: env.KNOT_AGENT_KEYPAIR_PATH,
    agentKeypairJson: env.KNOT_AGENT_KEYPAIR_JSON,
    gcpProjectId: env.GOOGLE_CLOUD_PROJECT ?? env.GCP_PROJECT_ID
  };
}

function defaultRpcUrl(cluster: string): string {
  if (cluster === "testnet") {
    return "https://api.testnet.solana.com";
  }
  if (cluster === "localnet") {
    return "http://127.0.0.1:8899";
  }
  return "https://api.devnet.solana.com";
}

function liveSigningRequested(value: string | undefined): boolean {
  return value === "live" || value === "devnet" || value === "testnet";
}
