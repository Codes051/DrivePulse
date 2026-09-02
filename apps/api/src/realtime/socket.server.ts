import type { Server as HttpServer } from "node:http";

import { Server as SocketServer } from "socket.io";

import type { TelemetryPayload } from "../schemas/telemetry.schema.js";

export interface LiveTelemetryEvent extends TelemetryPayload {
  id: string;
  vehicleId: string;
}

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

interface ServerToClientEvents {
  "telemetry:updated": (reading: LiveTelemetryEvent) => void;
  "alert:created": (alert: LiveAlertEvent) => void;
  "alert:updated": (alert: LiveAlertEvent) => void;
  "alert:resolved": (alert: LiveAlertEvent) => void;
  "maintenance:created": (
    recommendation: LiveMaintenanceEvent,
  ) => void;
  "maintenance:updated": (
    recommendation: LiveMaintenanceEvent,
  ) => void;
}

interface ClientToServerEvents {
  "vehicle:join": (vehicleId: string) => void;
  "vehicle:leave": (vehicleId: string) => void;
  "fleet:join": () => void;
  "fleet:leave": () => void;
}

let io:
  | SocketServer<ClientToServerEvents, ServerToClientEvents>
  | undefined;

export function startSocketServer(
  httpServer: HttpServer,
): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  if (io) {
    return io;
  }

  io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents
  >(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Dashboard connected: ${socket.id}`);

    socket.on("vehicle:join", (vehicleId) => {
      if (!vehicleId) {
        return;
      }

      void socket.join(`vehicle:${vehicleId}`);

      console.log(
        `Dashboard ${socket.id} joined vehicle:${vehicleId}`,
      );
    });

    socket.on("vehicle:leave", (vehicleId) => {
      if (!vehicleId) {
        return;
      }

      void socket.leave(`vehicle:${vehicleId}`);
    });

    socket.on("fleet:join", () => {
      void socket.join("fleet");

      console.log(
        `Dashboard ${socket.id} joined fleet`,
      );
    });

    socket.on("fleet:leave", () => {
      void socket.leave("fleet");
    });

    socket.on("disconnect", () => {
      console.log(`Dashboard disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitTelemetryUpdate(
  reading: LiveTelemetryEvent,
): void {
  io
    ?.to(`vehicle:${reading.vehicleId}`)
    .emit("telemetry:updated", reading);
}

export function emitAlertCreated(
  alert: LiveAlertEvent,
): void {
  io
    ?.to("fleet")
    .to(`vehicle:${alert.vehicleId}`)
    .emit("alert:created", alert);
}

export function emitAlertUpdated(
  alert: LiveAlertEvent,
): void {
  io
    ?.to("fleet")
    .to(`vehicle:${alert.vehicleId}`)
    .emit("alert:updated", alert);
}

export function emitAlertResolved(
  alert: LiveAlertEvent,
): void {
  io
    ?.to("fleet")
    .to(`vehicle:${alert.vehicleId}`)
    .emit("alert:resolved", alert);
}

export function emitMaintenanceCreated(
  recommendation: LiveMaintenanceEvent,
): void {
  io
    ?.to("fleet")
    .to(`vehicle:${recommendation.vehicleId}`)
    .emit(
      "maintenance:created",
      recommendation,
    );
}

export function emitMaintenanceUpdated(
  recommendation: LiveMaintenanceEvent,
): void {
  io
    ?.to("fleet")
    .to(`vehicle:${recommendation.vehicleId}`)
    .emit(
      "maintenance:updated",
      recommendation,
    );
}

export async function stopSocketServer(): Promise<void> {
  if (!io) {
    return;
  }

  const currentServer = io;
  io = undefined;

  await new Promise<void>((resolve) => {
    currentServer.close(() => {
      console.log("Socket.IO server closed.");
      resolve();
    });
  });
}