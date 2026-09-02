import type {
  Alert,
  MaintenancePriority,
  MaintenanceRecommendation,
  MaintenanceType,
} from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";

import {
  emitMaintenanceCreated,
  emitMaintenanceUpdated,
  type LiveMaintenanceEvent,
} from "../realtime/socket.server.js";

interface MaintenanceRule {
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description: string;
}

function toLiveMaintenanceEvent(
  recommendation: MaintenanceRecommendation,
): LiveMaintenanceEvent {
  return {
    id: recommendation.id,
    vehicleId: recommendation.vehicleId,
    type: recommendation.type,
    priority: recommendation.priority,
    status: recommendation.status,
    title: recommendation.title,
    description: recommendation.description,
    reason: recommendation.reason,
    createdAt: recommendation.createdAt.toISOString(),
    updatedAt: recommendation.updatedAt.toISOString(),
    completedAt:
      recommendation.completedAt?.toISOString() ?? null,
  };
}

function getRuleForAlert(
  alert: Alert,
): MaintenanceRule | null {
  switch (alert.type) {
    case "HIGH_TEMPERATURE":
      return {
        type: "COOLING_SYSTEM",
        priority:
          alert.severity === "CRITICAL"
            ? "CRITICAL"
            : "HIGH",
        title: "Inspect cooling system",
        description:
          "Check the cooling system, coolant circulation, radiator performance, and temperature sensors.",
      };

    case "LOW_BATTERY_VOLTAGE":
    case "LOW_BATTERY_PERCENTAGE":
      return {
        type: "BATTERY_SYSTEM",
        priority:
          alert.severity === "CRITICAL"
            ? "CRITICAL"
            : "HIGH",
        title: "Inspect battery system",
        description:
          "Check battery condition, charging performance, electrical connections, and voltage stability.",
      };

    case "EXCESSIVE_VIBRATION":
      return {
        type: "VIBRATION_INSPECTION",
        priority: "CRITICAL",
        title: "Inspect abnormal vibration",
        description:
          "Inspect drivetrain, wheel assemblies, mounting points, bearings, and other possible vibration sources.",
      };

    case "TELEMETRY_MISSING":
      return {
        type: "TELEMETRY_SYSTEM",
        priority: "HIGH",
        title: "Inspect telemetry system",
        description:
          "Check the vehicle telemetry device, network connectivity, MQTT communication, and power supply.",
      };

    default:
      return null;
  }
}

export async function createMaintenanceRecommendationFromAlert(
  alert: Alert,
): Promise<void> {
  const rule = getRuleForAlert(alert);

  if (!rule) {
    return;
  }

  const existingRecommendation =
    await prisma.maintenanceRecommendation.findFirst({
      where: {
        vehicleId: alert.vehicleId,
        type: rule.type,
        status: {
          in: [
            "OPEN",
            "IN_PROGRESS",
          ],
        },
      },
    });

  if (existingRecommendation) {
    return;
  }

  const createdRecommendation =
    await prisma.maintenanceRecommendation.create({
      data: {
        vehicleId: alert.vehicleId,
        type: rule.type,
        priority: rule.priority,
        status: "OPEN",
        title: rule.title,
        description: rule.description,
        reason: alert.message,
      },
    });

  emitMaintenanceCreated(
    toLiveMaintenanceEvent(
      createdRecommendation,
    ),
  );
}

export async function getMaintenanceRecommendations(
  options: {
    vehicleId?: string;
    status?: string;
  } = {},
) {
  return prisma.maintenanceRecommendation.findMany({
    where: {
      ...(options.vehicleId
        ? {
            vehicleId: options.vehicleId,
          }
        : {}),

      ...(options.status
        ? {
            status:
              options.status as
                | "OPEN"
                | "IN_PROGRESS"
                | "COMPLETED"
                | "DISMISSED",
          }
        : {}),
    },

    include: {
      vehicle: {
        select: {
          id: true,
          vehicleCode: true,
          manufacturer: true,
          model: true,
        },
      },
    },

    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function updateMaintenanceStatus(
  recommendationId: string,
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "DISMISSED",
) {
  const updatedRecommendation =
    await prisma.maintenanceRecommendation.update({
      where: {
        id: recommendationId,
      },

      data: {
        status,

        completedAt:
          status === "COMPLETED"
            ? new Date()
            : null,
      },
    });

  emitMaintenanceUpdated(
    toLiveMaintenanceEvent(
      updatedRecommendation,
    ),
  );

  return updatedRecommendation;
}