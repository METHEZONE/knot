import type { NextConfig } from "next";

/**
 * When the app is served behind another host's path prefix — thezonebio.com
 * proxies /knot/app to this deployment — set KNOT_BASE_PATH so Next emits
 * links and _next asset URLs under that prefix. Left empty for local dev and
 * for the root-served Cloud Run deployment, so neither changes.
 */
const basePath = process.env.KNOT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  output: "standalone",
};

export default nextConfig;
