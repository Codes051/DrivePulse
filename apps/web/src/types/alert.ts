export type AlertType =
  | "HIGH_TEMPERATURE"
  | "LOW_BATTERY_VOLTAGE"
  | "LOW_BATTERY_PERCENTAGE"
  | "EXCESSIVE_VIBRATION"
  | "TELEMETRY_MISSING";

export type AlertSeverity =
  | "INFO"
  | "WARNING"
  | "CRITICAL";

export type AlertStatus =
  | "ACTIVE"
  | "ACKNOWLEDGED"
  | "RESOLVED";

export interface AlertVehicle {
  id: string;
  vehicleCode: string;
}

export interface VehicleAlert {
  id: string;
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  triggeredAt: string;
  lastObservedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: AlertVehicle;
}
