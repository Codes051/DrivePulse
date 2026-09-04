import { Router } from "express";

import {
  getSimulationHealth,
  getSimulationStatus,
  setSimulationScenario,
  startSimulation,
  stopSimulation,
} from "../controllers/simulation.controller.js";

export const simulationRouter =
  Router();

simulationRouter.get(
  "/health",
  getSimulationHealth,
);

simulationRouter.get(
  "/:vehicleCode",
  getSimulationStatus,
);

simulationRouter.post(
  "/:vehicleCode/start",
  startSimulation,
);

simulationRouter.post(
  "/:vehicleCode/stop",
  stopSimulation,
);

simulationRouter.post(
  "/:vehicleCode/scenario/:scenario",
  setSimulationScenario,
);