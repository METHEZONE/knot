import express, { type Request, type Response } from "express";
import { loadConfig, type GatewayConfig } from "./config.js";
import { EscrowLockService } from "./escrow.js";
import {
  confirmAgreementMilestoneRelease,
  confirmBrandFunding,
  prepareAgreementMilestoneRelease,
  prepareBrandFunding
} from "./funding.js";

const lockRoute = /^\/internal\/v1\/escrows:lock$/;
const prepareFundingRoute = /^\/internal\/v1\/escrows:prepare-funding$/;
const confirmFundingRoute = /^\/internal\/v1\/escrows:confirm-funding$/;
const prepareReleaseRoute = /^\/internal\/v1\/escrows\/([^/]+)\/milestones\/([^/]+):prepare-release$/;
const confirmReleaseRoute = /^\/internal\/v1\/escrows\/([^/]+)\/milestones\/([^/]+):confirm-release$/;
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

  app.post(lockRoute, async (request: Request, response: Response) => {
    const result = await escrowLockService.lock(
      config,
      request.header("Idempotency-Key"),
      request.body
    );
    response.status(result.statusCode).json(result.body);
  });

  app.post(prepareFundingRoute, async (request: Request, response: Response) => {
    try {
      const result = await prepareBrandFunding(config, request.body);
      response.json({ data: result });
    } catch (error) {
      response.status(409).json({
        detail: {
          code: "FUNDING_PREPARE_FAILED",
          title: "Funding prepare failed",
          detail: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  app.post(confirmFundingRoute, async (request: Request, response: Response) => {
    try {
      const result = await confirmBrandFunding(config, request.body);
      response.json({ data: result });
    } catch (error) {
      response.status(409).json({
        detail: {
          code: "FUNDING_CONFIRM_FAILED",
          title: "Funding confirm failed",
          detail: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  app.post(prepareReleaseRoute, async (request: Request, response: Response) => {
    const match = prepareReleaseRoute.exec(request.path);
    if (!match) {
      response.status(404).json({ code: "NOT_FOUND", detail: "Route not found" });
      return;
    }
    const [, escrowId, milestoneId] = match;
    if (request.body?.escrowId !== escrowId || request.body?.milestoneId !== milestoneId) {
      response.status(400).json({
        detail: {
          code: "VALIDATION_ERROR",
          title: "Release prepare failed",
          detail: "Route and body escrowId or milestoneId mismatch"
        }
      });
      return;
    }
    try {
      const result = await prepareAgreementMilestoneRelease(config, request.body);
      response.json({ data: result });
    } catch (error) {
      response.status(409).json({
        detail: {
          code: "RELEASE_PREPARE_FAILED",
          title: "Release prepare failed",
          detail: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  app.post(confirmReleaseRoute, async (request: Request, response: Response) => {
    const match = confirmReleaseRoute.exec(request.path);
    if (!match) {
      response.status(404).json({ code: "NOT_FOUND", detail: "Route not found" });
      return;
    }
    const [, escrowId, milestoneId] = match;
    if (request.body?.escrowId !== escrowId || request.body?.milestoneId !== milestoneId) {
      response.status(400).json({
        detail: {
          code: "VALIDATION_ERROR",
          title: "Release confirm failed",
          detail: "Route and body escrowId or milestoneId mismatch"
        }
      });
      return;
    }
    try {
      const result = await confirmAgreementMilestoneRelease(config, request.body);
      response.json({ data: result });
    } catch (error) {
      response.status(409).json({
        detail: {
          code: "RELEASE_CONFIRM_FAILED",
          title: "Release confirm failed",
          detail: error instanceof Error ? error.message : String(error)
        }
      });
    }
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
