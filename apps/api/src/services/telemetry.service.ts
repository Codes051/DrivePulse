import { prisma } from "../lib/prisma.js";
import { emitTelemetryUpdate } from "../realtime/socket.server.js";
import type { TelemetryPayload } from "../schemas/telemetry.schema.js";

export async function saveTelemetry(
  payload: TelemetryPayload,
): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      vehicleCode: payload.vehicleCode,
    },
    select: {
      id: true,
    },
  });

  if (!vehicle) {
    console.warn(
      `Ignoring telemetry for unknown vehicle: ${payload.vehicleCode}`,
    );
    return;
  }

  const [reading] = await prisma.$transaction([
    prisma.telemetryReading.create({
      data: {
        vehicleId: vehicle.id,
        recordedAt: new Date(payload.recordedAt),
        speedKmh: payload.speedKmh,
        rpm: payload.rpm,
        temperatureC: payload.temperatureC,
        batteryVoltage: payload.batteryVoltage,
        batteryPercentage: payload.batteryPercentage,
        currentAmps: payload.currentAmps,
        vibration: payload.vibration,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
    }),

    prisma.vehicle.update({
      where: {
        id: vehicle.id,
      },
      data: {
        status: "ONLINE",
      },
    }),
  ]);

  emitTelemetryUpdate({
    id: reading.id.toString(),
    vehicleId: reading.vehicleId,
    vehicleCode: payload.vehicleCode,
    recordedAt: reading.recordedAt.toISOString(),
    speedKmh: reading.speedKmh,
    rpm: reading.rpm,
    temperatureC: reading.temperatureC,
    batteryVoltage: reading.batteryVoltage,
    batteryPercentage: reading.batteryPercentage,
    currentAmps: reading.currentAmps,
    vibration: reading.vibration,
    ...(reading.latitude !== null
      ? { latitude: reading.latitude }
      : {}),
    ...(reading.longitude !== null
      ? { longitude: reading.longitude }
      : {}),
  });
}
