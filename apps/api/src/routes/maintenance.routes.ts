import { Router } from "express";

import {
  getMaintenance,
  updateMaintenanceRecommendationStatus,
} from "../controllers/maintenance.controller.js";

export const maintenanceRouter = Router();

maintenanceRouter.get(
  "/",
  getMaintenance,
);

maintenanceRouter.patch(
  "/:id/status",
  updateMaintenanceRecommendationStatus,
);
