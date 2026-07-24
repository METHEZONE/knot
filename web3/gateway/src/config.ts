export type GatewayConfig = {
  serviceName: string;
  gitSha: string;
  buildTime: string;
  schemaVersion: string;
  solanaCluster: string;
  allowedMint: string;
  allowedProgramId: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    serviceName: env.KNOT_SERVICE_NAME ?? "knot-web3",
    gitSha: env.GIT_SHA ?? "local",
    buildTime: env.BUILD_TIME ?? "local",
    schemaVersion: "v1",
    solanaCluster: env.SOLANA_CLUSTER ?? "devnet",
    allowedMint: env.KNOT_USDC_MINT ?? "demo-usdc-mint",
    allowedProgramId: env.KNOT_ESCROW_PROGRAM_ID ?? "demo-escrow-program"
  };
}
