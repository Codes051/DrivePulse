export type VehicleStatus =
  | "ONLINE"
  | "OFFLINE"
  | "WARNING"
  | "MAINTENANCE";

export interface Vehicle {
  id: string;
  vehicleCode: string;
  manufacturer: string;
  model: string;
  year: number | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TelemetryReading {
  id: string;
  vehicleId: string;
  recordedAt: string;
  speedKmh: number;
  rpm: number;
  temperatureC: number;
  batteryVoltage: number;
  batteryPercentage: number;
  currentAmps: number;
  vibration: number;
  latitude: number | null;
  longitude: number | null;
}

export interface VehiclesResponse {
  count: number;
  vehicles: Vehicle[];
}

export interface LatestTelemetryResponse {
  vehicle: Pick<
    Vehicle,
    "id" | "vehicleCode" | "manufacturer" | "model" | "status"
  >;
  telemetry: TelemetryReading | null;
}

export interface TelemetryHistoryResponse {
  vehicle: Pick<
    Vehicle,
    "id" | "vehicleCode" | "manufacturer" | "model"
  >;
  count: number;
  telemetry: TelemetryReading[];
}
