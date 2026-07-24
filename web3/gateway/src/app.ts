import express, { type Request, type Response } from "express";
import { loadConfig, type GatewayConfig } from "./config.js";
import { EscrowLockService } from "./escrow.js";

export function createApp(
  config: GatewayConfig = loadConfig(),
  escrowLockService = new EscrowLockService()
) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/healthz", (_request: Request, response: Response) => {
    response.json({ status: "ok", service: config.serviceName });
  });

  app.get("/readyz", (_request: Request, response: Response) => {
    response.json({ status: "ready", service: config.serviceName });
  });

  app.get("/version", (_request: Request, response: Response) => {
    response.json({
      service: config.serviceName,
      gitSha: config.gitSha,
      buildTime: config.buildTime,
      schemaVersion: config.schemaVersion
    });
  });

  app.post("/internal/v1/escrows:lock", (request: Request, response: Response) => {
    const result = escrowLockService.lock(config, request.header("Idempotency-Key"), request.body);
    response.status(result.statusCode).json(result.body);
  });

  return app;
}
