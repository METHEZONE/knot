import express, { type Request, type Response } from "express";
import { loadConfig, type GatewayConfig } from "./config.js";
import { EscrowLockService } from "./escrow.js";
import { airdrop } from "./faucet.js";

const releaseRoute = /^\/internal\/v1\/escrows\/([^/]+)\/milestones\/([^/]+):release$/;

async function handleRelease(
  config: GatewayConfig,
  escrowLockService: EscrowLockService,
  request: Request,
  response: Response,
  escrowId: string,
  milestoneId: string
) {
  const result = await escrowLockService.release(
    config,
    request.header("Idempotency-Key"),
    escrowId,
    milestoneId,
    request.body
  );
  response.status(result.statusCode).json(result.body);
}

function firstParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

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

  // 로컬 밸리데이터 전용 faucet — 사람이 Phantom 을 연결하면 그 주소에 SOL 을 채운다.
  app.post("/internal/v1/faucet:airdrop", async (request: Request, response: Response) => {
    const result = await airdrop(config, request.body);
    response.status(result.statusCode).json(result.body);
  });

  app.post("/internal/v1/escrows:lock", async (request: Request, response: Response) => {
    const result = await escrowLockService.lock(
      config,
      request.header("Idempotency-Key"),
      request.body
    );
    response.status(result.statusCode).json(result.body);
  });

  app.post(releaseRoute, async (request: Request, response: Response) => {
    const match = releaseRoute.exec(request.path);
    if (!match) {
      response.status(404).json({ code: "NOT_FOUND", detail: "Route not found" });
      return;
    }
    const [, escrowId, milestoneId] = match;
    await handleRelease(config, escrowLockService, request, response, escrowId, milestoneId);
  });

  app.post(
    "/internal/v1/escrows/:escrowId/milestones/:milestoneId/release",
    async (request: Request, response: Response) => {
      await handleRelease(
        config,
        escrowLockService,
        request,
        response,
        firstParam(request.params.escrowId),
        firstParam(request.params.milestoneId)
      );
    }
  );

  return app;
}
