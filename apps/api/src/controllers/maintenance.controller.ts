import type { Request, Response } from "express";

import {
  getMaintenanceRecommendations,
  updateMaintenanceStatus,
} from "../services/maintenance.service.js";

const validStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "DISMISSED",
] as const;

type MaintenanceStatus =
  (typeof validStatuses)[number];

function isMaintenanceStatus(
  value: string,
): value is MaintenanceStatus {
  return validStatuses.includes(
    value as MaintenanceStatus,
  );
}

export async function getMaintenance(
  request: Request,
  response: Response,
): Promise<void> {
  const vehicleId =
    typeof request.query.vehicleId === "string"
      ? request.query.vehicleId
      : undefined;

  const requestedStatus =
    typeof request.query.status === "string"
      ? request.query.status.toUpperCase()
      : undefined;

  if (
    requestedStatus &&
    !isMaintenanceStatus(requestedStatus)
  ) {
    response.status(400).json({
      message: "Invalid maintenance status.",
    });
    return;
  }

  const recommendations =
    await getMaintenanceRecommendations({
      vehicleId,
      status: requestedStatus,
    });

  response.json(recommendations);
}

export async function updateMaintenanceRecommendationStatus(
  request: Request,
  response: Response,
): Promise<void> {
  const recommendationId = request.params.id;

  if (
    typeof recommendationId !== "string" ||
    recommendationId.trim() === ""
  ) {
    response.status(400).json({
      message:
        "A valid maintenance recommendation ID is required.",
    });
    return;
  }

  const requestedStatus =
    typeof request.body?.status === "string"
      ? request.body.status.toUpperCase()
      : "";

  if (
    !isMaintenanceStatus(requestedStatus)
  ) {
    response.status(400).json({
      message: "Invalid maintenance status.",
    });
    return;
  }

  try {
    const updatedRecommendation =
      await updateMaintenanceStatus(
        recommendationId,
        requestedStatus,
      );

    response.json(updatedRecommendation);
  } catch (error) {
    console.error(
      "Unable to update maintenance recommendation:",
      error,
    );

    response.status(404).json({
      message:
        "Maintenance recommendation not found.",
    });
  }
}
