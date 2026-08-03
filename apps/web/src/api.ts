import type {
  LatestTelemetryResponse,
  TelemetryHistoryResponse,
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
