import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const validStatuses = [
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
] as const;

type AlertStatusFilter = (typeof validStatuses)[number];

function isAlertStatus(value: string): value is AlertStatusFilter {
  return validStatuses.includes(value as AlertStatusFilter);
}

export async function getAlerts(
  request: Request,
  response: Response,
): Promise<void> {
  const requestedStatus =
    typeof request.query.status === "string"
      ? request.query.status.toUpperCase()
      : undefined;

  const vehicleId =
    typeof request.query.vehicleId === "string"
      ? request.query.vehicleId
      : undefined;

  const status =
    requestedStatus && isAlertStatus(requestedStatus)
      ? requestedStatus
      : undefined;

  const alerts = await prisma.alert.findMany({
    where: {
      ...(vehicleId ? { vehicleId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      vehicle: {
        select: {
          id: true,
          vehicleCode: true,
        },
      },
    },
    orderBy: {
      triggeredAt: "desc",
    },
  });

  response.json(alerts);
}

export async function acknowledgeAlert(
  request: Request,
  response: Response,
): Promise<void> {
  const alertId = request.params.id;

  if (typeof alertId !== "string" || alertId.trim() === "") {
    response.status(400).json({
      message: "A valid alert ID is required.",
    });
    return;
  }

  const alert = await prisma.alert.findUnique({
    where: {
      id: alertId,
    },
  });

  if (!alert) {
    response.status(404).json({
      message: "Alert not found.",
    });
    return;
  }

  if (alert.status === "RESOLVED") {
    response.status(400).json({
      message: "Resolved alerts cannot be acknowledged.",
    });
    return;
  }

  const updatedAlert = await prisma.alert.update({
    where: {
      id: alert.id,
    },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
    },
  });

  response.json(updatedAlert);
}
