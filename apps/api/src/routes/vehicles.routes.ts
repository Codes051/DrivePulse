import { Router } from "express";

import {
  createVehicle,
  deleteVehicle,
  getVehicleById,
  getVehicles,
  updateVehicle,
} from "../controllers/vehicles.controller.js";

export const vehiclesRouter = Router();

vehiclesRouter.get("/", getVehicles);
vehiclesRouter.get("/:id", getVehicleById);
vehiclesRouter.post("/", createVehicle);
vehiclesRouter.patch("/:id", updateVehicle);
vehiclesRouter.delete("/:id", deleteVehicle);
