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
    trendPenalty: number;
  };

  trends: {
    sampleCount: number;
    windowMinutes: number;
    temperatureChangeC: number;
    vibrationChange: number;
    batteryVoltageChange: number;
    temperatureRatePerMinute: number;
    vibrationRatePerMinute: number;
    batteryVoltageRatePerMinute: number;
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

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

interface TrendPoint {
  timeMinutes: number;
  value: number;
}

function calculateSlope(
  points: TrendPoint[],
): number {
  if (points.length < 2) {
    return 0;
  }

  const meanX =
    points.reduce(
      (sum, point) => sum + point.timeMinutes,
      0,
    ) / points.length;

  const meanY =
    points.reduce(
      (sum, point) => sum + point.value,
      0,
    ) / points.length;

  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    const xDifference =
      point.timeMinutes - meanX;

    numerator +=
      xDifference *
      (point.value - meanY);

    denominator +=
      xDifference *
      xDifference;
  }

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

export async function calculateVehicleHealth(
  vehicleId: string,
): Promise<VehicleHealthScore> {
  const telemetry =
    await prisma.telemetryReading.findMany({
      where: {
        vehicleId,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 30,
    });

  const latestTelemetry = telemetry[0];

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
        trendPenalty: 0,
      },

      trends: {
        sampleCount: 0,
        windowMinutes: 0,
        temperatureChangeC: 0,
        vibrationChange: 0,
        batteryVoltageChange: 0,
        temperatureRatePerMinute: 0,
        vibrationRatePerMinute: 0,
        batteryVoltageRatePerMinute: 0,
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

  /*
   * Snapshot penalties
   */

  const temperaturePenalty =
    latestTelemetry.temperatureC <= 80
      ? 0
      : clamp(
          latestTelemetry.temperatureC - 80,
          0,
          30,
        );

  const vibrationPenalty =
    latestTelemetry.vibration <= 0.4
      ? 0
      : clamp(
          ((latestTelemetry.vibration - 0.4) /
            0.8) *
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

  /*
   * Trend analysis
   *
   * Prisma returns newest first.
   * Reverse so regression sees readings
   * from oldest to newest.
   */

  const chronologicalTelemetry =
    [...telemetry].reverse();

  const oldestTelemetry =
    chronologicalTelemetry[0]!;

  const windowMs =
    latestTelemetry.recordedAt.getTime() -
    oldestTelemetry.recordedAt.getTime();

  const windowMinutes =
    windowMs > 0
      ? windowMs / 60_000
      : 0;

  const baseTime =
    oldestTelemetry.recordedAt.getTime();

  const temperaturePoints: TrendPoint[] =
    chronologicalTelemetry.map((reading) => ({
      timeMinutes:
        (reading.recordedAt.getTime() -
          baseTime) /
        60_000,
      value: reading.temperatureC,
    }));

  const vibrationPoints: TrendPoint[] =
    chronologicalTelemetry.map((reading) => ({
      timeMinutes:
        (reading.recordedAt.getTime() -
          baseTime) /
        60_000,
      value: reading.vibration,
    }));

  const batteryVoltagePoints: TrendPoint[] =
    chronologicalTelemetry.map((reading) => ({
      timeMinutes:
        (reading.recordedAt.getTime() -
          baseTime) /
        60_000,
      value: reading.batteryVoltage,
    }));

  const temperatureRatePerMinute =
    calculateSlope(temperaturePoints);

  const vibrationRatePerMinute =
    calculateSlope(vibrationPoints);

  const batteryVoltageRatePerMinute =
    calculateSlope(batteryVoltagePoints);

  const temperatureChangeC =
    latestTelemetry.temperatureC -
    oldestTelemetry.temperatureC;

  const vibrationChange =
    latestTelemetry.vibration -
    oldestTelemetry.vibration;

  const batteryVoltageChange =
    latestTelemetry.batteryVoltage -
    oldestTelemetry.batteryVoltage;

  /*
   * Trend penalties
   *
   * We require at least 10 readings
   * before assigning trend risk.
   */

  let temperatureTrendPenalty = 0;
  let vibrationTrendPenalty = 0;
  let voltageTrendPenalty = 0;

  if (
    telemetry.length >= 10 &&
    windowMinutes > 0
  ) {
    /*
     * Temperature:
     * No trend penalty up to 1 C/min.
     * Maximum 8 points.
     */
    if (
      temperatureRatePerMinute > 1
    ) {
      temperatureTrendPenalty = clamp(
        (temperatureRatePerMinute - 1) *
          1.5,
        0,
        8,
      );
    }

    /*
     * Vibration:
     * Ignore small fluctuations.
     * Maximum 6 points.
     */
    if (
      vibrationRatePerMinute > 0.03
    ) {
      vibrationTrendPenalty = clamp(
        (vibrationRatePerMinute - 0.03) *
          20,
        0,
        6,
      );
    }

    /*
     * Battery voltage:
     * Negative slope indicates falling voltage.
     * Maximum 6 points.
     */
    if (
      batteryVoltageRatePerMinute <
      -0.03
    ) {
      voltageTrendPenalty = clamp(
        (
          Math.abs(
            batteryVoltageRatePerMinute,
          ) -
          0.03
        ) *
          12,
        0,
        6,
      );
    }
  }

  const trendPenalty = clamp(
    temperatureTrendPenalty +
      vibrationTrendPenalty +
      voltageTrendPenalty,
    0,
    20,
  );

  const rawScore =
    100 -
    temperaturePenalty -
    vibrationPenalty -
    batteryVoltagePenalty -
    batteryPercentagePenalty -
    alertPenalty -
    telemetryFreshnessPenalty -
    trendPenalty;

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
        Math.round(
          batteryVoltagePenalty,
        ),

      batteryPercentagePenalty:
        Math.round(
          batteryPercentagePenalty,
        ),

      alertPenalty:
        Math.round(alertPenalty),

      telemetryFreshnessPenalty:
        Math.round(
          telemetryFreshnessPenalty,
        ),

      trendPenalty:
        Math.round(trendPenalty),
    },

    trends: {
      sampleCount: telemetry.length,

      windowMinutes:
        round(windowMinutes),

      temperatureChangeC:
        round(temperatureChangeC),

      vibrationChange:
        round(vibrationChange, 3),

      batteryVoltageChange:
        round(batteryVoltageChange),

      temperatureRatePerMinute:
        round(
          temperatureRatePerMinute,
        ),

      vibrationRatePerMinute:
        round(
          vibrationRatePerMinute,
          3,
        ),

      batteryVoltageRatePerMinute:
        round(
          batteryVoltageRatePerMinute,
          3,
        ),
    },
  };
}
