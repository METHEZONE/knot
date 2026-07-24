import express, { type Request, type Response } from "express";
import { z } from "zod";
import { loadConfig, type GatewayConfig } from "./config.js";

const lockRequestSchema = z.object({
  agreementId: z.string().min(1),
  termsHash: z.string().startsWith("sha256:"),
  expectedAmountBaseUnits: z.string().regex(/^[0-9]+$/)
});

export function createApp(config: GatewayConfig = loadConfig()) {
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
    const result = lockRequestSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        detail: "Invalid escrow lock request"
      });
      return;
    }

    response.status(501).json({
      code: "NOT_IMPLEMENTED",
      detail: "Escrow lock signing is not implemented in the M0 skeleton"
    });
  });

  return app;
}
