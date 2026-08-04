import type {
  AlertStatus,
  VehicleAlert,
} from "../types/alert";

const apiUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface GetAlertsOptions {
  vehicleId?: string;
  status?: AlertStatus;
}

export async function getAlerts(
  options: GetAlertsOptions = {},
): Promise<VehicleAlert[]> {
  const searchParameters = new URLSearchParams();

  if (options.vehicleId) {
    searchParameters.set("vehicleId", options.vehicleId);
  }

  if (options.status) {
    searchParameters.set("status", options.status);
  }

  const query = searchParameters.toString();

  const response = await fetch(
    `${apiUrl}/api/alerts${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load alerts: ${response.status}`,
    );
  }

  return response.json() as Promise<VehicleAlert[]>;
}

export async function acknowledgeAlert(
  alertId: string,
): Promise<VehicleAlert> {
  const response = await fetch(
    `${apiUrl}/api/alerts/${alertId}/acknowledge`,
    {
      method: "PATCH",
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    throw new Error(
      body?.message ??
        `Failed to acknowledge alert: ${response.status}`,
    );
  }

  return response.json() as Promise<VehicleAlert>;
}
