import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findLatestTelemetry: vi.fn(),
  findActiveAlerts: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    telemetryReading: {
      findFirst: mocks.findLatestTelemetry,
    },
    alert: {
      findMany: mocks.findActiveAlerts,
    },
  },
}));

import {
  calculateVehicleHealth,
} from "./health.service.js";

describe("calculateVehicleHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-08-31T12:00:00.000Z"),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns EXCELLENT health for normal fresh telemetry", async () => {
    mocks.findLatestTelemetry.mockResolvedValue({
      temperatureC: 70,
      vibration: 0.2,
      batteryVoltage: 12.6,
      batteryPercentage: 90,
      recordedAt: new Date(
        "2026-08-31T11:59:50.000Z",
      ),
    });

    mocks.findActiveAlerts.mockResolvedValue([]);

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
    });
  });

  it("reduces health for high temperature and a critical alert", async () => {
    mocks.findLatestTelemetry.mockResolvedValue({
      temperatureC: 101.5,
      vibration: 0.2,
      batteryVoltage: 12.6,
      batteryPercentage: 90,
      recordedAt: new Date(
        "2026-08-31T11:59:50.000Z",
      ),
    });

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
  });

  it("penalizes stale telemetry", async () => {
    mocks.findLatestTelemetry.mockResolvedValue({
      temperatureC: 70,
      vibration: 0.2,
      batteryVoltage: 12.6,
      batteryPercentage: 90,
      recordedAt: new Date(
        "2026-08-31T11:54:00.000Z",
      ),
    });

    mocks.findActiveAlerts.mockResolvedValue([]);

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(80);
    expect(health.condition).toBe("GOOD");

    expect(
      health.factors.telemetryFreshnessPenalty,
    ).toBe(20);
  });

  it("returns zero health when no telemetry exists", async () => {
    mocks.findLatestTelemetry.mockResolvedValue(
      null,
    );

    const health =
      await calculateVehicleHealth("vehicle-1");

    expect(health.score).toBe(0);
    expect(health.condition).toBe("POOR");

    expect(
      health.factors.telemetryFreshnessPenalty,
    ).toBe(100);

    expect(
      mocks.findActiveAlerts,
    ).not.toHaveBeenCalled();
  });
});
