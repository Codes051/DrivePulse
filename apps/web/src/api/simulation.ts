export type SimulationScenario =
  | "normal"
  | "high-temperature"
  | "low-battery"
  | "vibration";

export interface SimulationStatus {
  vehicleCode: string;
  running: boolean;
  scenario: SimulationScenario;
}

export interface SimulationHealth {
  status: string;
  service: string;
  mqttConnected: boolean;
  simulations: SimulationStatus[];
}

const apiUrl =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

async function simulationRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const response = await fetch(
    `${apiUrl}${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
      },
    },
  );

  const body = (await response
    .json()
    .catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      body &&
      typeof body === "object" &&
      "error" in body
        ? body.error ??
            "Simulation request failed."
        : "Simulation request failed.",
    );
  }

  return body as T;
}

export function getSimulationHealth():
Promise<SimulationHealth> {
  return simulationRequest<SimulationHealth>(
    "/api/simulation/health",
  );
}

export function getSimulationStatus(
  vehicleCode: string,
): Promise<SimulationStatus> {
  return simulationRequest<SimulationStatus>(
    `/api/simulation/${encodeURIComponent(
      vehicleCode,
    )}`,
  );
}

export function startSimulation(
  vehicleCode: string,
): Promise<SimulationStatus> {
  return simulationRequest<SimulationStatus>(
    `/api/simulation/${encodeURIComponent(
      vehicleCode,
    )}/start`,
    "POST",
  );
}

export function stopSimulation(
  vehicleCode: string,
): Promise<SimulationStatus> {
  return simulationRequest<SimulationStatus>(
    `/api/simulation/${encodeURIComponent(
      vehicleCode,
    )}/stop`,
    "POST",
  );
}

export function setSimulationScenario(
  vehicleCode: string,
  scenario: SimulationScenario,
): Promise<SimulationStatus> {
  return simulationRequest<SimulationStatus>(
    `/api/simulation/${encodeURIComponent(
      vehicleCode,
    )}/scenario/${scenario}`,
    "POST",
  );
}