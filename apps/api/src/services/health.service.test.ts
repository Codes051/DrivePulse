import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findTelemetry: vi.fn(),
  findActiveAlerts: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    telemetryReading: {
      findMany: mocks.findTelemetry,
    },
    alert: {
      findMany: mocks.findActiveAlerts,
    },
  },
}));

import {
  calculateVehicleHealth,
} from "./health.service.js";

function reading(
  recordedAt: string,
  overrides: Partial<{
    temperatureC: number;
    vibration: number;
    batteryVoltage: number;
    batteryPercentage: number;
  }> = {},
) {
  return {
    temperatureC: 70,
    vibration: 0.2,
    batteryVoltage: 12.6,
    batteryPercentage: 90,
    recordedAt: new Date(recordedAt),
    ...overrides,
  };
}

describe("calculateVehicleHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-08-31T12:00:00.000Z"),
    );

    mocks.findActiveAlerts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns EXCELLENT health for normal fresh telemetry", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading("2026-08-31T11:59:50.000Z"),
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(100);
    expect(health.condition).toBe("EXCELLENT");

    expect(health.factors).toEqual({
      temperaturePenalty: 0,
      vibrationPenalty: 0,
      batteryVoltagePenalty: 0,
      batteryPercentagePenalty: 0,
      alertPenalty: 0,
      telemetryFreshnessPenalty: 0,
      trendPenalty: 0,
    });

    expect(health.trends.sampleCount).toBe(1);
  });

  it("reduces health for high temperature and a critical alert", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading(
        "2026-08-31T11:59:50.000Z",
        {
          temperatureC: 101.5,
        },
      ),
    ]);

    mocks.findActiveAlerts.mockResolvedValue([
      {
        severity: "CRITICAL",
      },
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(59);
    expect(health.condition).toBe("POOR");

    expect(
      health.factors.temperaturePenalty,
    ).toBe(22);

    expect(
      health.factors.alertPenalty,
    ).toBe(20);

    expect(
      health.factors.trendPenalty,
    ).toBe(0);
  });

  it("penalizes stale telemetry", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading("2026-08-31T11:54:00.000Z"),
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(80);
    expect(health.condition).toBe("GOOD");

    expect(
      health.factors.telemetryFreshnessPenalty,
    ).toBe(20);
  });

  it("returns zero health when no telemetry exists", async () => {
    mocks.findTelemetry.mockResolvedValue([]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(0);
    expect(health.condition).toBe("POOR");
    expect(health.trends.sampleCount).toBe(0);

    expect(
      health.factors.telemetryFreshnessPenalty,
    ).toBe(100);

    expect(
      mocks.findActiveAlerts,
    ).not.toHaveBeenCalled();
  });

  it("detects a sustained rising temperature trend", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading("2026-08-31T11:59:58.000Z", { temperatureC: 79 }),
      reading("2026-08-31T11:59:52.000Z", { temperatureC: 78 }),
      reading("2026-08-31T11:59:46.000Z", { temperatureC: 77 }),
      reading("2026-08-31T11:59:40.000Z", { temperatureC: 76 }),
      reading("2026-08-31T11:59:34.000Z", { temperatureC: 75 }),
      reading("2026-08-31T11:59:28.000Z", { temperatureC: 74 }),
      reading("2026-08-31T11:59:22.000Z", { temperatureC: 73 }),
      reading("2026-08-31T11:59:16.000Z", { temperatureC: 72 }),
      reading("2026-08-31T11:59:10.000Z", { temperatureC: 71 }),
      reading("2026-08-31T11:59:04.000Z", { temperatureC: 70 }),
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(
      health.trends.temperatureRatePerMinute,
    ).toBeGreaterThan(1);

    expect(
      health.factors.trendPenalty,
    ).toBeGreaterThan(0);

    expect(health.score).toBeLessThan(100);
  });

  it("ignores small normal temperature fluctuations", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading("2026-08-31T11:59:58.000Z", { temperatureC: 70.5 }),
      reading("2026-08-31T11:59:52.000Z", { temperatureC: 70.4 }),
      reading("2026-08-31T11:59:46.000Z", { temperatureC: 70.3 }),
      reading("2026-08-31T11:59:40.000Z", { temperatureC: 70.3 }),
      reading("2026-08-31T11:59:34.000Z", { temperatureC: 70.2 }),
      reading("2026-08-31T11:59:28.000Z", { temperatureC: 70.2 }),
      reading("2026-08-31T11:59:22.000Z", { temperatureC: 70.1 }),
      reading("2026-08-31T11:59:16.000Z", { temperatureC: 70.1 }),
      reading("2026-08-31T11:59:10.000Z", { temperatureC: 70 }),
      reading("2026-08-31T11:59:04.000Z", { temperatureC: 70 }),
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(
      health.trends.temperatureRatePerMinute,
    ).toBeLessThanOrEqual(1);

    expect(
      health.factors.trendPenalty,
    ).toBe(0);
  });

  it("detects worsening vibration and falling voltage", async () => {
    mocks.findTelemetry.mockResolvedValue([
      reading("2026-08-31T11:59:58.000Z", {
        vibration: 0.31,
        batteryVoltage: 12.42,
      }),
      reading("2026-08-31T11:59:52.000Z", {
        vibration: 0.30,
        batteryVoltage: 12.44,
      }),
      reading("2026-08-31T11:59:46.000Z", {
        vibration: 0.29,
        batteryVoltage: 12.46,
      }),
      reading("2026-08-31T11:59:40.000Z", {
        vibration: 0.28,
        batteryVoltage: 12.48,
      }),
      reading("2026-08-31T11:59:34.000Z", {
        vibration: 0.27,
        batteryVoltage: 12.50,
      }),
      reading("2026-08-31T11:59:28.000Z", {
        vibration: 0.26,
        batteryVoltage: 12.52,
      }),
      reading("2026-08-31T11:59:22.000Z", {
        vibration: 0.25,
        batteryVoltage: 12.54,
      }),
      reading("2026-08-31T11:59:16.000Z", {
        vibration: 0.24,
        batteryVoltage: 12.56,
      }),
      reading("2026-08-31T11:59:10.000Z", {
        vibration: 0.23,
        batteryVoltage: 12.58,
      }),
      reading("2026-08-31T11:59:04.000Z", {
        vibration: 0.22,
        batteryVoltage: 12.60,
      }),
    ]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(
      health.trends.vibrationRatePerMinute,
    ).toBeGreaterThan(0.03);

    expect(
      health.trends.batteryVoltageRatePerMinute,
    ).toBeLessThan(-0.03);

    expect(
      health.factors.trendPenalty,
    ).toBeGreaterThan(0);
  });
});
