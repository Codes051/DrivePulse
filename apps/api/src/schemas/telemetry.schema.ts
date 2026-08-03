import { z } from "zod";

export const telemetryPayloadSchema = z.object({
  vehicleCode: z.string().trim().min(1).max(30),
  recordedAt: z.string().datetime({ offset: true }),
  speedKmh: z.number().min(0).max(400),
  rpm: z.number().int().min(0).max(20000),
  temperatureC: z.number().min(-100).max(250),
  batteryVoltage: z.number().min(0).max(1000),
  batteryPercentage: z.number().min(0).max(100),
  currentAmps: z.number().min(0).max(5000),
  vibration: z.number().min(0).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
