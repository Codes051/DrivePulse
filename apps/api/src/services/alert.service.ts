import type {
  Alert,
  AlertSeverity,
  AlertType,
} from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  emitAlertCreated,
  emitAlertResolved,
  emitAlertUpdated,
  type LiveAlertEvent,
} from "../realtime/socket.server.js";
import type { TelemetryPayload } from "../schemas/telemetry.schema.js";

interface AlertRule {
  type: AlertType;
  severity: AlertSeverity;
  isTriggered: (payload: TelemetryPayload) => boolean;
  message: (payload: TelemetryPayload) => string;
}

type PendingAlertEvent =
  | {
      event: "created";
      alert: Alert;
    }
  | {
      event: "updated";
      alert: Alert;
    }
  | {
      event: "resolved";
      alert: Alert;
    };

const alertRules: AlertRule[] = [
  {
    type: "HIGH_TEMPERATURE",
    severity: "CRITICAL",
    isTriggered: (payload) =>
      payload.temperatureC >= 95,
    message: (payload) =>
      `Temperature reached ${payload.temperatureC.toFixed(1)} C.`,
  },
  {
    type: "LOW_BATTERY_VOLTAGE",
    severity: "WARNING",
    isTriggered: (payload) =>
      payload.batteryVoltage <= 11.8,
    message: (payload) =>
      `Battery voltage dropped to ${payload.batteryVoltage.toFixed(2)} V.`,
  },
  {
    type: "LOW_BATTERY_PERCENTAGE",
    severity: "WARNING",
    isTriggered: (payload) =>
      payload.batteryPercentage <= 20,
    message: (payload) =>
      `Battery charge dropped to ${payload.batteryPercentage.toFixed(1)}%.`,
  },
  {
    type: "EXCESSIVE_VIBRATION",
    severity: "CRITICAL",
    isTriggered: (payload) =>
      payload.vibration >= 0.8,
    message: (payload) =>
      `Vibration reached ${payload.vibration.toFixed(3)}.`,
  },
];

function toLiveAlertEvent(
  alert: Alert,
): LiveAlertEvent {
  return {
    id: alert.id,
    vehicleId: alert.vehicleId,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    triggeredAt: alert.triggeredAt.toISOString(),
    lastObservedAt:
      alert.lastObservedAt.toISOString(),
    acknowledgedAt:
      alert.acknowledgedAt?.toISOString() ?? null,
    resolvedAt:
      alert.resolvedAt?.toISOString() ?? null,
  };
}

export async function evaluateTelemetryAlerts(
  vehicleId: string,
  payload: TelemetryPayload,
): Promise<void> {
  const observedAt = new Date(payload.recordedAt);

  const pendingEvents: PendingAlertEvent[] = [];

  for (const rule of alertRules) {
    const existingAlert =
      await prisma.alert.findFirst({
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
        const updatedAlert =
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

        pendingEvents.push({
          event: "updated",
          alert: updatedAlert,
        });
      } else {
        const createdAlert =
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

        pendingEvents.push({
          event: "created",
          alert: createdAlert,
        });
      }

      continue;
    }

    if (existingAlert) {
      const resolvedAlert =
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

      pendingEvents.push({
        event: "resolved",
        alert: resolvedAlert,
      });
    }
  }

  const activeAlertCount =
    await prisma.alert.count({
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
      status:
        activeAlertCount > 0
          ? "WARNING"
          : "ONLINE",
    },
  });

  for (const pendingEvent of pendingEvents) {
    const event =
      toLiveAlertEvent(pendingEvent.alert);

    switch (pendingEvent.event) {
      case "created":
        emitAlertCreated(event);
        break;

      case "updated":
        emitAlertUpdated(event);
        break;

      case "resolved":
        emitAlertResolved(event);
        break;
    }
  }
}
