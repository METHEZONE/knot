export type GatewayConfig = {
  serviceName: string;
  gitSha: string;
  buildTime: string;
  schemaVersion: string;
  solanaCluster: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    serviceName: env.KNOT_SERVICE_NAME ?? "knot-web3",
    gitSha: env.GIT_SHA ?? "local",
    buildTime: env.BUILD_TIME ?? "local",
    schemaVersion: "v1",
    solanaCluster: env.SOLANA_CLUSTER ?? "devnet"
  };
}
