import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface LiveAlertEvent {
  id: string;
  vehicleId: string;
  type:
    | "HIGH_TEMPERATURE"
    | "LOW_BATTERY_VOLTAGE"
    | "LOW_BATTERY_PERCENTAGE"
    | "EXCESSIVE_VIBRATION"
    | "TELEMETRY_MISSING";
  severity:
    | "INFO"
    | "WARNING"
    | "CRITICAL";
  status:
    | "ACTIVE"
    | "ACKNOWLEDGED"
    | "RESOLVED";
  message: string;
  triggeredAt: string;
  lastObservedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface LiveMaintenanceEvent {
  id: string;
  vehicleId: string;
  type:
    | "COOLING_SYSTEM"
    | "BATTERY_SYSTEM"
    | "VIBRATION_INSPECTION"
    | "TELEMETRY_SYSTEM"
    | "GENERAL_INSPECTION";
  priority:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "DISMISSED";
  title: string;
  description: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});