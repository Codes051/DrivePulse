import type {
  CreateVehicleInput,
  CreateVehicleResponse,
  LatestTelemetryResponse,
  TelemetryHistoryResponse,
  Vehicle,
  VehiclesResponse,
} from "./types";

const apiUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function requestJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as { error?: string } | null;

    throw new Error(
      errorBody?.error ??
        `Request failed with status ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}

export function fetchVehicles(
  signal?: AbortSignal,
): Promise<VehiclesResponse> {
  return requestJson<VehiclesResponse>(
    "/api/vehicles",
    signal,
  );
}

export async function createVehicle(
  input: CreateVehicleInput,
): Promise<Vehicle> {
  const response = await fetch(
    `${apiUrl}/api/vehicles`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = (await response
    .json()
    .catch(() => null)) as
    | CreateVehicleResponse
    | {
        error?: string;
        details?: Array<{
          field: string;
          message: string;
        }>;
      }
    | null;

  if (!response.ok) {
    const validationMessage =
      data &&
      "details" in data &&
      data.details?.length
        ? data.details
            .map((issue) => issue.message)
            .join(" ")
        : null;

    const errorMessage =
      data &&
      "error" in data
        ? data.error
        : null;

    throw new Error(
      validationMessage ??
        errorMessage ??
        `Request failed with status ${response.status}.`,
    );
  }

  return (data as CreateVehicleResponse).vehicle;
}

export function fetchLatestTelemetry(
  vehicleId: string,
  signal?: AbortSignal,
): Promise<LatestTelemetryResponse> {
  return requestJson<LatestTelemetryResponse>(
    `/api/vehicles/${vehicleId}/telemetry/latest`,
    signal,
  );
}

export function fetchTelemetryHistory(
  vehicleId: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<TelemetryHistoryResponse> {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  return requestJson<TelemetryHistoryResponse>(
    `/api/vehicles/${vehicleId}/telemetry/history?${query}`,
    signal,
  );
}