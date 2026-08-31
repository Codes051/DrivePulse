import { prisma } from "../lib/prisma.js";

export type HealthCondition =
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR";

export interface VehicleHealthScore {
  vehicleId: string;
  score: number;
  condition: HealthCondition;
  calculatedAt: string;
  factors: {
    temperaturePenalty: number;
    vibrationPenalty: number;
    batteryVoltagePenalty: number;
    batteryPercentagePenalty: number;
    alertPenalty: number;
    telemetryFreshnessPenalty: number;
  };
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function getCondition(
  score: number,
): HealthCondition {
  if (score >= 90) {
    return "EXCELLENT";
  }

  if (score >= 75) {
    return "GOOD";
  }

  if (score >= 60) {
    return "FAIR";
  }

  return "POOR";
}

export async function calculateVehicleHealth(
  vehicleId: string,
): Promise<VehicleHealthScore> {
  const latestTelemetry =
    await prisma.telemetryReading.findFirst({
      where: {
        vehicleId,
      },
      orderBy: {
        recordedAt: "desc",
      },
    });

  if (!latestTelemetry) {
    return {
      vehicleId,
      score: 0,
      condition: "POOR",
      calculatedAt: new Date().toISOString(),
      factors: {
        temperaturePenalty: 0,
        vibrationPenalty: 0,
        batteryVoltagePenalty: 0,
        batteryPercentagePenalty: 0,
        alertPenalty: 0,
        telemetryFreshnessPenalty: 100,
      },
    };
  }

  const activeAlerts =
    await prisma.alert.findMany({
      where: {
        vehicleId,
        status: {
          in: [
            "ACTIVE",
            "ACKNOWLEDGED",
          ],
        },
      },
      select: {
        severity: true,
      },
    });

  const temperaturePenalty =
    latestTelemetry.temperatureC <= 80
      ? 0
      : clamp(
          ((latestTelemetry.temperatureC - 80) / 30) *
            30,
          0,
          30,
        );

  const vibrationPenalty =
    latestTelemetry.vibration <= 0.4
      ? 0
      : clamp(
          ((latestTelemetry.vibration - 0.4) / 0.8) *
            25,
          0,
          25,
        );

  const batteryVoltagePenalty =
    latestTelemetry.batteryVoltage >= 12.4
      ? 0
      : clamp(
          ((12.4 -
            latestTelemetry.batteryVoltage) /
            1.4) *
            20,
          0,
          20,
        );

  const batteryPercentagePenalty =
    latestTelemetry.batteryPercentage >= 40
      ? 0
      : clamp(
          ((40 -
            latestTelemetry.batteryPercentage) /
            40) *
            15,
          0,
          15,
        );

  const alertPenalty = clamp(
    activeAlerts.reduce(
      (total, alert) => {
        if (
          alert.severity === "CRITICAL"
        ) {
          return total + 20;
        }

        if (
          alert.severity === "WARNING"
        ) {
          return total + 10;
        }

        return total + 5;
      },
      0,
    ),
    0,
    30,
  );

  const readingAgeMs =
    Date.now() -
    latestTelemetry.recordedAt.getTime();

  const telemetryFreshnessPenalty =
    readingAgeMs > 5 * 60 * 1000
      ? 20
      : 0;

  const rawScore =
    100 -
    temperaturePenalty -
    vibrationPenalty -
    batteryVoltagePenalty -
    batteryPercentagePenalty -
    alertPenalty -
    telemetryFreshnessPenalty;

  const score = Math.round(
    clamp(rawScore, 0, 100),
  );

  return {
    vehicleId,
    score,
    condition: getCondition(score),
    calculatedAt: new Date().toISOString(),
    factors: {
      temperaturePenalty:
        Math.round(temperaturePenalty),
      vibrationPenalty:
        Math.round(vibrationPenalty),
      batteryVoltagePenalty:
        Math.round(batteryVoltagePenalty),
      batteryPercentagePenalty:
        Math.round(batteryPercentagePenalty),
      alertPenalty:
        Math.round(alertPenalty),
      telemetryFreshnessPenalty:
        Math.round(
          telemetryFreshnessPenalty,
        ),
    },
  };
}
