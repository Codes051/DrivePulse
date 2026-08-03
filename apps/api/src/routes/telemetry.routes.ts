import { Router } from "express";

import {
  getLatestTelemetry,
  getTelemetryHistory,
} from "../controllers/telemetry.controller.js";

export const telemetryRouter = Router({
  mergeParams: true,
});

telemetryRouter.get("/latest", getLatestTelemetry);
telemetryRouter.get("/history", getTelemetryHistory);
