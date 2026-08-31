import type { Alert } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  emitAlertCreated,
  emitAlertResolved,
  type LiveAlertEvent,
} from "../realtime/socket.server.js";

const TELEMETRY_TIMEOUT_MS = 30_000;

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

export async function checkTelemetryTimeouts(): Promise<void> {
  const cutoff = new Date(
    Date.now() - TELEMETRY_TIMEOUT_MS,
  );

  const vehicles = await prisma.vehicle.findMany({
    include: {
      telemetryReadings: {
        orderBy: {
          recordedAt: "desc",
        },
        take: 1,
      },
    },
  });

  for (const vehicle of vehicles) {
    const latestReading =
      vehicle.telemetryReadings[0];

    if (!latestReading) {
      continue;
    }

    const telemetryIsStale =
      latestReading.recordedAt < cutoff;

    const existingMissingAlert =
      await prisma.alert.findFirst({
        where: {
          vehicleId: vehicle.id,
          type: "TELEMETRY_MISSING",
          status: {
            in: ["ACTIVE", "ACKNOWLEDGED"],
          },
        },
        orderBy: {
          triggeredAt: "desc",
        },
      });

    if (telemetryIsStale) {
      if (!existingMissingAlert) {
        const alert =
          await prisma.alert.create({
            data: {
              vehicleId: vehicle.id,
              type: "TELEMETRY_MISSING",
              severity: "CRITICAL",
              status: "ACTIVE",
              message:
                "Telemetry has not been received within the expected interval.",
              triggeredAt: new Date(),
              lastObservedAt: new Date(),
            },
          });

        await prisma.vehicle.update({
          where: {
            id: vehicle.id,
          },
          data: {
            status: "OFFLINE",
          },
        });

        emitAlertCreated(
          toLiveAlertEvent(alert),
        );
      }

      continue;
    }

    if (existingMissingAlert) {
      const resolvedAlert =
        await prisma.alert.update({
          where: {
            id: existingMissingAlert.id,
          },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            lastObservedAt: new Date(),
          },
        });

      const activeAlertCount =
        await prisma.alert.count({
          where: {
            vehicleId: vehicle.id,
            status: {
              in: [
                "ACTIVE",
                "ACKNOWLEDGED",
              ],
            },
          },
        });

      await prisma.vehicle.update({
        where: {
          id: vehicle.id,
        },
        data: {
          status:
            activeAlertCount > 0
              ? "WARNING"
              : "ONLINE",
        },
      });

      emitAlertResolved(
        toLiveAlertEvent(resolvedAlert),
      );
    }
  }
}
