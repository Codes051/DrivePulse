import type {
  AlertSeverity,
  AlertType,
} from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { TelemetryPayload } from "../schemas/telemetry.schema.js";

interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  isTriggered: (payload: TelemetryPayload) => boolean;
  message: (payload: TelemetryPayload) => string;
}

const alertRules: AlertRule[] = [
  {
    type: "HIGH_TEMPERATURE",
    severity: "CRITICAL",
    isTriggered: (payload) => payload.temperatureC >= 95,
    message: (payload) =>
      `Temperature reached ${payload.temperatureC.toFixed(1)} C.`,
  },
  {
    type: "LOW_BATTERY_VOLTAGE",
    severity: "WARNING",
    isTriggered: (payload) => payload.batteryVoltage <= 11.8,
    message: (payload) =>
      `Battery voltage dropped to ${payload.batteryVoltage.toFixed(2)} V.`,
  },
  {
    type: "LOW_BATTERY_PERCENTAGE",
    severity: "WARNING",
    isTriggered: (payload) => payload.batteryPercentage <= 20,
    message: (payload) =>
      `Battery charge dropped to ${payload.batteryPercentage.toFixed(1)}%.`,
  },
  {
    type: "EXCESSIVE_VIBRATION",
    severity: "CRITICAL",
    isTriggered: (payload) => payload.vibration >= 0.8,
    message: (payload) =>
      `Vibration reached ${payload.vibration.toFixed(3)}.`,
  },
];

export async function evaluateTelemetryAlerts(
  vehicleId: string,
  payload: TelemetryPayload,
): Promise<void> {
  const observedAt = new Date(payload.recordedAt);

  for (const rule of alertRules) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        vehicleId,
        type: rule.type,
        status: {
          in: ["ACTIVE", "ACKNOWLEDGED"],
        },
      },
      orderBy: {
        triggeredAt: "desc",
      },
    });

    if (rule.isTriggered(payload)) {
      if (existingAlert) {
        await prisma.alert.update({
          where: {
            id: existingAlert.id,
          },
          data: {
            severity: rule.severity,
            message: rule.message(payload),
            lastObservedAt: observedAt,
          },
        });
      } else {
        await prisma.alert.create({
          data: {
            vehicleId,
            type: rule.type,
            severity: rule.severity,
            status: "ACTIVE",
            message: rule.message(payload),
            triggeredAt: observedAt,
            lastObservedAt: observedAt,
          },
        });
      }

      continue;
    }

    if (existingAlert) {
      await prisma.alert.update({
        where: {
          id: existingAlert.id,
        },
        data: {
          status: "RESOLVED",
          resolvedAt: observedAt,
          lastObservedAt: observedAt,
        },
      });
    }
  }

  const activeAlertCount = await prisma.alert.count({
    where: {
      vehicleId,
      status: {
        in: ["ACTIVE", "ACKNOWLEDGED"],
      },
    },
  });

  await prisma.vehicle.update({
    where: {
      id: vehicleId,
    },
    data: {
      status: activeAlertCount > 0 ? "WARNING" : "ONLINE",
    },
  });
}
