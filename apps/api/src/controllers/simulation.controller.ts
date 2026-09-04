import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { prisma } from "../lib/prisma.js";

const simulationServiceUrl =
  process.env.SIMULATION_SERVICE_URL ??
  "http://127.0.0.1:3010";

const validScenarios = new Set([
  "normal",
  "high-temperature",
  "low-battery",
  "vibration",
]);

interface VehicleParams {
  vehicleCode: string;
}

interface ScenarioParams extends VehicleParams {
  scenario: string;
}

async function findVehicle(
  vehicleCode: string,
) {
  return prisma.vehicle.findUnique({
    where: {
      vehicleCode:
        vehicleCode.trim().toUpperCase(),
    },
  });
}

async function requestSimulationService(
  path: string,
  method: "GET" | "POST" = "GET",
): Promise<unknown> {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    5000,
  );

  try {
    const response = await fetch(
      `${simulationServiceUrl}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    const body = (await response
      .json()
      .catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        body?.error ??
          `Simulation service returned ${response.status}.`,
      );
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function sendSimulationUnavailable(
  response: Response,
  error: unknown,
): void {
  console.error(
    "Simulation service error:",
    error,
  );

  response.status(503).json({
    error:
      "Simulation service is currently unavailable.",
  });
}

export async function getSimulationHealth(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const result =
      await requestSimulationService(
        "/health",
      );

    response.status(200).json(result);
  } catch (error) {
    sendSimulationUnavailable(
      response,
      error,
    );
  }
}

export async function getSimulationStatus(
  request: Request<VehicleParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await findVehicle(
      request.params.vehicleCode,
    );

    if (!vehicle) {
      response.status(404).json({
        error:
          "Vehicle is not registered in DrivePulse.",
      });
      return;
    }

    try {
      const result =
        await requestSimulationService(
          `/simulation/${encodeURIComponent(
            vehicle.vehicleCode,
          )}`,
        );

      response.status(200).json(result);
    } catch (error) {
      sendSimulationUnavailable(
        response,
        error,
      );
    }
  } catch (error) {
    next(error);
  }
}

export async function startSimulation(
  request: Request<VehicleParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await findVehicle(
      request.params.vehicleCode,
    );

    if (!vehicle) {
      response.status(404).json({
        error:
          "Vehicle is not registered in DrivePulse.",
      });
      return;
    }

    try {
      const result =
        await requestSimulationService(
          `/simulation/${encodeURIComponent(
            vehicle.vehicleCode,
          )}/start`,
          "POST",
        );

      response.status(200).json(result);
    } catch (error) {
      sendSimulationUnavailable(
        response,
        error,
      );
    }
  } catch (error) {
    next(error);
  }
}

export async function stopSimulation(
  request: Request<VehicleParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await findVehicle(
      request.params.vehicleCode,
    );

    if (!vehicle) {
      response.status(404).json({
        error:
          "Vehicle is not registered in DrivePulse.",
      });
      return;
    }

    try {
      const result =
        await requestSimulationService(
          `/simulation/${encodeURIComponent(
            vehicle.vehicleCode,
          )}/stop`,
          "POST",
        );

      response.status(200).json(result);
    } catch (error) {
      sendSimulationUnavailable(
        response,
        error,
      );
    }
  } catch (error) {
    next(error);
  }
}

export async function setSimulationScenario(
  request: Request<ScenarioParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const scenario =
    request.params.scenario;

  if (!validScenarios.has(scenario)) {
    response.status(400).json({
      error:
        "Unsupported simulation scenario.",
    });
    return;
  }

  try {
    const vehicle = await findVehicle(
      request.params.vehicleCode,
    );

    if (!vehicle) {
      response.status(404).json({
        error:
          "Vehicle is not registered in DrivePulse.",
      });
      return;
    }

    try {
      const result =
        await requestSimulationService(
          `/simulation/${encodeURIComponent(
            vehicle.vehicleCode,
          )}/scenario/${encodeURIComponent(
            scenario,
          )}`,
          "POST",
        );

      response.status(200).json(result);
    } catch (error) {
      sendSimulationUnavailable(
        response,
        error,
      );
    }
  } catch (error) {
    next(error);
  }
}