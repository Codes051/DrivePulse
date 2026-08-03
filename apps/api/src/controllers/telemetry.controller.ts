import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

type VehicleIdParams = {
  id: string;
};

const historyQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100),

  from: z
    .string()
    .datetime({ offset: true })
    .optional(),

  to: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

export async function getLatestTelemetry(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: request.params.id,
      },
      select: {
        id: true,
        vehicleCode: true,
        manufacturer: true,
        model: true,
        status: true,
      },
    });

    if (!vehicle) {
      response.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    const telemetry = await prisma.telemetryReading.findFirst({
      where: {
        vehicleId: vehicle.id,
      },
      orderBy: {
        recordedAt: "desc",
      },
    });

    response.status(200).json({
      vehicle,
      telemetry,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTelemetryHistory(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const queryResult = historyQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    response.status(400).json({
      error: "Invalid query parameters",
      details: queryResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const { limit, from, to } = queryResult.data;

  if (from && to && new Date(from) > new Date(to)) {
    response.status(400).json({
      error: "The from date cannot be after the to date.",
    });
    return;
  }

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: request.params.id,
      },
      select: {
        id: true,
        vehicleCode: true,
        manufacturer: true,
        model: true,
      },
    });

    if (!vehicle) {
      response.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    const telemetry = await prisma.telemetryReading.findMany({
      where: {
        vehicleId: vehicle.id,

        recordedAt:
          from || to
            ? {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              }
            : undefined,
      },

      orderBy: {
        recordedAt: "desc",
      },

      take: limit,
    });

    response.status(200).json({
      vehicle,
      count: telemetry.length,
      telemetry,
    });
  } catch (error) {
    next(error);
  }
}
