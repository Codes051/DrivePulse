import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  vehicleFindMany: vi.fn(),
  vehicleUpdate: vi.fn(),
  alertFindFirst: vi.fn(),
  alertCreate: vi.fn(),
  alertUpdate: vi.fn(),
  alertCount: vi.fn(),
  emitCreated: vi.fn(),
  emitResolved: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    vehicle: {
      findMany: mocks.vehicleFindMany,
      update: mocks.vehicleUpdate,
    },
    alert: {
      findFirst: mocks.alertFindFirst,
      create: mocks.alertCreate,
      update: mocks.alertUpdate,
      count: mocks.alertCount,
    },
  },
}));

vi.mock("../realtime/socket.server.js", () => ({
  emitAlertCreated: mocks.emitCreated,
  emitAlertResolved: mocks.emitResolved,
}));

import {
  checkTelemetryTimeouts,
} from "./telemetry-watchdog.service.js";

describe("checkTelemetryTimeouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-08-31T12:00:00.000Z"),
    );

    mocks.alertFindFirst.mockResolvedValue(null);
    mocks.alertCount.mockResolvedValue(0);
    mocks.vehicleUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a TELEMETRY_MISSING alert and marks the vehicle OFFLINE when telemetry is stale", async () => {
    mocks.vehicleFindMany.mockResolvedValue([
      {
        id: "vehicle-1",
        telemetryReadings: [
          {
            recordedAt: new Date(
              "2026-08-31T11:59:00.000Z",
            ),
          },
        ],
      },
    ]);

    const createdAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "TELEMETRY_MISSING",
      severity: "CRITICAL",
      status: "ACTIVE",
      message:
        "Telemetry has not been received within the expected interval.",
      triggeredAt: new Date(
        "2026-08-31T12:00:00.000Z",
      ),
      lastObservedAt: new Date(
        "2026-08-31T12:00:00.000Z",
      ),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.alertCreate.mockResolvedValue(createdAlert);

    await checkTelemetryTimeouts();

    expect(mocks.alertCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "vehicle-1",
        type: "TELEMETRY_MISSING",
        severity: "CRITICAL",
        status: "ACTIVE",
      }),
    });

    expect(mocks.vehicleUpdate).toHaveBeenCalledWith({
      where: {
        id: "vehicle-1",
      },
      data: {
        status: "OFFLINE",
      },
    });

    expect(mocks.emitCreated).toHaveBeenCalledTimes(1);
  });

  it("does not create a duplicate missing-telemetry alert", async () => {
    mocks.vehicleFindMany.mockResolvedValue([
      {
        id: "vehicle-1",
        telemetryReadings: [
          {
            recordedAt: new Date(
              "2026-08-31T11:59:00.000Z",
            ),
          },
        ],
      },
    ]);

    mocks.alertFindFirst.mockResolvedValue({
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "TELEMETRY_MISSING",
      severity: "CRITICAL",
      status: "ACTIVE",
      message:
        "Telemetry has not been received within the expected interval.",
      triggeredAt: new Date(),
      lastObservedAt: new Date(),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await checkTelemetryTimeouts();

    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.emitCreated).not.toHaveBeenCalled();
  });

  it("resolves the missing-telemetry alert when fresh telemetry returns", async () => {
    mocks.vehicleFindMany.mockResolvedValue([
      {
        id: "vehicle-1",
        telemetryReadings: [
          {
            recordedAt: new Date(
              "2026-08-31T11:59:50.000Z",
            ),
          },
        ],
      },
    ]);

    const existingAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "TELEMETRY_MISSING",
      severity: "CRITICAL",
      status: "ACTIVE",
      message:
        "Telemetry has not been received within the expected interval.",
      triggeredAt: new Date(
        "2026-08-31T11:58:00.000Z",
      ),
      lastObservedAt: new Date(
        "2026-08-31T11:58:00.000Z",
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
        "2026-08-31T12:00:00.000Z",
      ),
      lastObservedAt: new Date(
        "2026-08-31T12:00:00.000Z",
      ),
    };

    mocks.alertFindFirst.mockResolvedValue(existingAlert);
    mocks.alertUpdate.mockResolvedValue(resolvedAlert);
    mocks.alertCount.mockResolvedValue(0);

    await checkTelemetryTimeouts();

    expect(mocks.alertUpdate).toHaveBeenCalledWith({
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

  it("returns the vehicle to WARNING if another alert is still active", async () => {
    mocks.vehicleFindMany.mockResolvedValue([
      {
        id: "vehicle-1",
        telemetryReadings: [
          {
            recordedAt: new Date(
              "2026-08-31T11:59:50.000Z",
            ),
          },
        ],
      },
    ]);

    const existingAlert = {
      id: "alert-1",
      vehicleId: "vehicle-1",
      type: "TELEMETRY_MISSING",
      severity: "CRITICAL",
      status: "ACTIVE",
      message:
        "Telemetry has not been received within the expected interval.",
      triggeredAt: new Date(),
      lastObservedAt: new Date(),
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.alertFindFirst.mockResolvedValue(existingAlert);

    mocks.alertUpdate.mockResolvedValue({
      ...existingAlert,
      status: "RESOLVED",
      resolvedAt: new Date(),
    });

    mocks.alertCount.mockResolvedValue(1);

    await checkTelemetryTimeouts();

    expect(mocks.vehicleUpdate).toHaveBeenCalledWith({
      where: {
        id: "vehicle-1",
      },
      data: {
        status: "WARNING",
      },
    });
  });
});
