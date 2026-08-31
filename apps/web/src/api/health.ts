import type { VehicleHealth } from "../types/health";

const apiUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function getVehicleHealth(
  vehicleId: string,
): Promise<VehicleHealth> {
  const response = await fetch(
    `${apiUrl}/api/vehicles/${vehicleId}/health`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load vehicle health: ${response.status}`,
    );
  }

  return response.json() as Promise<VehicleHealth>;
}
