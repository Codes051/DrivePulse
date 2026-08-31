import type {
  Request,
  Response,
} from "express";

import {
  calculateVehicleHealth,
} from "../services/health.service.js";

export async function getVehicleHealth(
  request: Request,
  response: Response,
): Promise<void> {
  const vehicleId =
    request.params.id;

  if (
    typeof vehicleId !== "string" ||
    vehicleId.trim() === ""
  ) {
    response.status(400).json({
      message:
        "A valid vehicle ID is required.",
    });

    return;
  }

  const health =
    await calculateVehicleHealth(
      vehicleId,
    );

  response.json(health);
}
