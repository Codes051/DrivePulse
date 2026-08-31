import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  vehicleUpdate: vi.fn(),
  emitCreated: vi.fn(),
  emitUpdated: vi.fn(),
  emitResolved: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    alert: {
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      count: mocks.count,
    },
    vehicle: {
      update: mocks.vehicleUpdate,
    },
  },
}));

vi.mock("../realtime/socket.server.js", () => ({
  emitAlertCreated: mocks.emitCreated,
  emitAlertUpdated: mocks.emitUpdated,
  emitAlertResolved: mocks.emitResolved,
}));

import {
  evaluateTelemetryAlerts,
} from "./alert.service.js";

const baseTelemetry = {
  vehicleCode: "CAR-001",
  recordedAt: "2026-08-31T12:00:00.000Z",
  speedKmh: 60,
  rpm: 2500,
  temperatureC: 70,
  batteryVoltage: 12.6,
  batteryPercentage: 90,
  currentAmps: 8.5,
  vibration: 0.2,
  latitude: -25.7479,
  longitude: 28.2293,
};

describe("evaluateTelemetryAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    mocks.vehicleUpdate.mockResolvedValue({});
  });

  it("creates a high-temperature alert", async () => {
    const createdAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "HIGH_TEMPERATURE",
      severity: "CRITICAL",
      status: "ACTIVE",
      message: "Temperature reached 101.5 C.",
      triggeredAt: new Date(baseTelemetry.recordedAt),
      lastObservedAt: new Date(baseTelemetry.recordedAt),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.create.mockResolvedValue(createdAlert);
    mocks.count.mockResolvedValue(1);

    await evaluateTelemetryAlerts(
      "vehicle-1",
      {
        ...baseTelemetry,
        temperatureC: 101.5,
      },
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "vehicle-1",
        type: "HIGH_TEMPERATURE",
        severity: "CRITICAL",
        status: "ACTIVE",
      }),
    });

    expect(mocks.vehicleUpdate).toHaveBeenCalledWith({
      where: {
        id: "vehicle-1",
      },
      data: {
        status: "WARNING",
      },
    });

    expect(mocks.emitCreated).toHaveBeenCalledTimes(1);
  });

  it("updates an existing alert instead of creating a duplicate", async () => {
    const existingAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "HIGH_TEMPERATURE",
      severity: "CRITICAL",
      status: "ACTIVE",
      message: "Temperature reached 100.0 C.",
      triggeredAt: new Date(
        "2026-08-31T11:59:00.000Z",
      ),
      lastObservedAt: new Date(
        "2026-08-31T11:59:00.000Z",
      ),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedAlert = {
      ...existingAlert,
      message: "Temperature reached 101.5 C.",
      lastObservedAt: new Date(
        baseTelemetry.recordedAt,
      ),
    };

    mocks.findFirst.mockImplementation(
      async ({ where }) => {
        if (
          where.type === "HIGH_TEMPERATURE"
        ) {
          return existingAlert;
        }

        return null;
      },
    );

    mocks.update.mockResolvedValue(updatedAlert);
    mocks.count.mockResolvedValue(1);

    await evaluateTelemetryAlerts(
      "vehicle-1",
      {
        ...baseTelemetry,
        temperatureC: 101.5,
      },
    );

    expect(mocks.create).not.toHaveBeenCalled();

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "alert-1",
      },
      data: expect.objectContaining({
        severity: "CRITICAL",
        message: "Temperature reached 101.5 C.",
      }),
    });

    expect(mocks.emitUpdated).toHaveBeenCalledTimes(1);
  });

  it("resolves a high-temperature alert when temperature returns to normal", async () => {
    const existingAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "HIGH_TEMPERATURE",
      severity: "CRITICAL",
      status: "ACTIVE",
      message: "Temperature reached 101.5 C.",
      triggeredAt: new Date(
        "2026-08-31T11:59:00.000Z",
      ),
      lastObservedAt: new Date(
        "2026-08-31T11:59:00.000Z",
      ),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resolvedAlert = {
      ...existingAlert,
      status: "RESOLVED",
      resolvedAt: new Date(
        baseTelemetry.recordedAt,
      ),
      lastObservedAt: new Date(
        baseTelemetry.recordedAt,
      ),
    };

    mocks.findFirst.mockImplementation(
      async ({ where }) => {
        if (
          where.type === "HIGH_TEMPERATURE"
        ) {
          return existingAlert;
        }

        return null;
      },
    );

    mocks.update.mockResolvedValue(resolvedAlert);
    mocks.count.mockResolvedValue(0);

    await evaluateTelemetryAlerts(
      "vehicle-1",
      {
        ...baseTelemetry,
        temperatureC: 70,
      },
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "alert-1",
      },
      data: expect.objectContaining({
        status: "RESOLVED",
      }),
    });

    expect(mocks.vehicleUpdate).toHaveBeenCalledWith({
      where: {
        id: "vehicle-1",
      },
      data: {
        status: "ONLINE",
      },
    });

    expect(mocks.emitResolved).toHaveBeenCalledTimes(1);
  });
});
