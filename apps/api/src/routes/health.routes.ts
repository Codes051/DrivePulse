import { Router } from "express";

import {
  getVehicleHealth,
} from "../controllers/health.controller.js";

export const healthRouter =
  Router();

healthRouter.get(
  "/:id/health",
  getVehicleHealth,
);
