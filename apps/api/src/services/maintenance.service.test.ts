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
  findMany: vi.fn(),
  update: vi.fn(),
  emitCreated: vi.fn(),
  emitUpdated: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    maintenanceRecommendation: {
      findFirst: mocks.findFirst,
      create: mocks.create,
      findMany: mocks.findMany,
      update: mocks.update,
    },
  },
}));

vi.mock("../realtime/socket.server.js", () => ({
  emitMaintenanceCreated: mocks.emitCreated,
  emitMaintenanceUpdated: mocks.emitUpdated,
}));

import {
  createMaintenanceRecommendationFromAlert,
  updateMaintenanceStatus,
} from "./maintenance.service.js";

function createAlert(
  overrides: Partial<{
    id: string;
    vehicleId: string;
    type:
      | "HIGH_TEMPERATURE"
      | "LOW_BATTERY_VOLTAGE"
      | "LOW_BATTERY_PERCENTAGE"
      | "EXCESSIVE_VIBRATION"
      | "TELEMETRY_MISSING";
    severity:
      | "INFO"
      | "WARNING"
      | "CRITICAL";
    message: string;
  }> = {},
) {
  return {
    id: "alert-1",
    vehicleId: "vehicle-1",
    type: "HIGH_TEMPERATURE" as const,
    severity: "CRITICAL" as const,
    status: "ACTIVE" as const,
    message: "Temperature reached 101.5 C.",
    triggeredAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    lastObservedAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    acknowledgedAt: null,
    resolvedAt: null,
    createdAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    updatedAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    ...overrides,
  };
}

function recommendation(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "maintenance-1",
    vehicleId: "vehicle-1",
    type: "COOLING_SYSTEM",
    priority: "CRITICAL",
    status: "OPEN",
    title: "Inspect cooling system",
    description:
      "Check the cooling system, coolant circulation, radiator performance, and temperature sensors.",
    reason: "Temperature reached 101.5 C.",
    createdAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    updatedAt: new Date(
      "2026-09-02T12:00:00.000Z",
    ),
    completedAt: null,
    ...overrides,
  };
}

describe("maintenance service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
  });

  it("creates a CRITICAL cooling-system recommendation for high temperature", async () => {
    const created = recommendation();

    mocks.create.mockResolvedValue(created);

    await createMaintenanceRecommendationFromAlert(
      createAlert(),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        vehicleId: "vehicle-1",
        type: "COOLING_SYSTEM",
        priority: "CRITICAL",
        status: "OPEN",
        title: "Inspect cooling system",
        description:
          "Check the cooling system, coolant circulation, radiator performance, and temperature sensors.",
        reason: "Temperature reached 101.5 C.",
      },
    });

    expect(mocks.emitCreated).toHaveBeenCalledTimes(1);

    expect(mocks.emitCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "maintenance-1",
        type: "COOLING_SYSTEM",
        priority: "CRITICAL",
        status: "OPEN",
      }),
    );
  });

  it("creates a HIGH battery recommendation for a low-battery warning", async () => {
    mocks.create.mockResolvedValue(
      recommendation({
        type: "BATTERY_SYSTEM",
        priority: "HIGH",
        title: "Inspect battery system",
        reason:
          "Battery voltage dropped to 11.70 V.",
      }),
    );

    await createMaintenanceRecommendationFromAlert(
      createAlert({
        type: "LOW_BATTERY_VOLTAGE",
        severity: "WARNING",
        message:
          "Battery voltage dropped to 11.70 V.",
      }),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "vehicle-1",
        type: "BATTERY_SYSTEM",
        priority: "HIGH",
        status: "OPEN",
        title: "Inspect battery system",
      }),
    });
  });

  it("creates a CRITICAL vibration inspection recommendation", async () => {
    mocks.create.mockResolvedValue(
      recommendation({
        type: "VIBRATION_INSPECTION",
        priority: "CRITICAL",
        title: "Inspect abnormal vibration",
        reason: "Vibration reached 0.900.",
      }),
    );

    await createMaintenanceRecommendationFromAlert(
      createAlert({
        type: "EXCESSIVE_VIBRATION",
        severity: "CRITICAL",
        message: "Vibration reached 0.900.",
      }),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "VIBRATION_INSPECTION",
        priority: "CRITICAL",
        title: "Inspect abnormal vibration",
      }),
    });
  });

  it("does not create a duplicate open recommendation", async () => {
    mocks.findFirst.mockResolvedValue(
      recommendation(),
    );

    await createMaintenanceRecommendationFromAlert(
      createAlert(),
    );

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.emitCreated).not.toHaveBeenCalled();
  });

  it("marks a recommendation completed and emits the update", async () => {
    const completedAt = new Date(
      "2026-09-02T12:30:00.000Z",
    );

    mocks.update.mockResolvedValue(
      recommendation({
        status: "COMPLETED",
        completedAt,
      }),
    );

    const result =
      await updateMaintenanceStatus(
        "maintenance-1",
        "COMPLETED",
      );

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "maintenance-1",
      },
      data: {
        status: "COMPLETED",
        completedAt: expect.any(Date),
      },
    });

    expect(result.status).toBe("COMPLETED");

    expect(mocks.emitUpdated).toHaveBeenCalledTimes(1);

    expect(mocks.emitUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "maintenance-1",
        status: "COMPLETED",
      }),
    );
  });

  it("keeps completedAt null for a recommendation moved to IN_PROGRESS", async () => {
    mocks.update.mockResolvedValue(
      recommendation({
        status: "IN_PROGRESS",
        completedAt: null,
      }),
    );

    await updateMaintenanceStatus(
      "maintenance-1",
      "IN_PROGRESS",
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "maintenance-1",
      },
      data: {
        status: "IN_PROGRESS",
        completedAt: null,
      },
    });

    expect(mocks.emitUpdated).toHaveBeenCalledTimes(1);
  });
});
