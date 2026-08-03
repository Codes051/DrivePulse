import type { VehiclesResponse } from "./types";

const apiUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchVehicles(
  signal?: AbortSignal,
): Promise<VehiclesResponse> {
  const response = await fetch(`${apiUrl}/api/vehicles`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load vehicles. Server returned ${response.status}.`,
    );
  }

  return (await response.json()) as VehiclesResponse;
}
