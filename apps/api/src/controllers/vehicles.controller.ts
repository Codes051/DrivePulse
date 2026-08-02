import type { NextFunction, Request, Response } from "express";

type VehicleIdParams = {
  id: string;
};

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "../schemas/vehicle.schema.js";

function sendValidationError(
  response: Response,
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>,
): void {
  response.status(400).json({
    error: "Validation failed",
    details: issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function getVehicles(
  _request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: {
        vehicleCode: "asc",
      },
    });

    response.status(200).json({
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
}

export async function getVehicleById(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: request.params.id,
      },
    });

    if (!vehicle) {
      response.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    response.status(200).json({
      vehicle,
    });
  } catch (error) {
    next(error);
  }
}

export async function createVehicle(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const result = createVehicleSchema.safeParse(request.body);

  if (!result.success) {
    sendValidationError(response, result.error.issues);
    return;
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: result.data,
    });

    response.status(201).json({
      message: "Vehicle created successfully",
      vehicle,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({
        error: "A vehicle with this vehicle code already exists.",
      });
      return;
    }

    next(error);
  }
}

export async function updateVehicle(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const result = updateVehicleSchema.safeParse(request.body);

  if (!result.success) {
    sendValidationError(response, result.error.issues);
    return;
  }

  try {
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: request.params.id,
      },
      select: {
        id: true,
      },
    });

    if (!existingVehicle) {
      response.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    const vehicle = await prisma.vehicle.update({
      where: {
        id: request.params.id,
      },
      data: result.data,
    });

    response.status(200).json({
      message: "Vehicle updated successfully",
      vehicle,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({
        error: "A vehicle with this vehicle code already exists.",
      });
      return;
    }

    next(error);
  }
}

export async function deleteVehicle(
  request: Request<VehicleIdParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: request.params.id,
      },
      select: {
        id: true,
      },
    });

    if (!existingVehicle) {
      response.status(404).json({
        error: "Vehicle not found",
      });
      return;
    }

    await prisma.vehicle.delete({
      where: {
        id: request.params.id,
      },
    });

    response.status(200).json({
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

