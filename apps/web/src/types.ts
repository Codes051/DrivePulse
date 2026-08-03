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

export interface VehiclesResponse {
  count: number;
  vehicles: Vehicle[];
}
