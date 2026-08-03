import type { Server as HttpServer } from "node:http";

import { Server as SocketServer } from "socket.io";

import type { TelemetryPayload } from "../schemas/telemetry.schema.js";

export interface LiveTelemetryEvent extends TelemetryPayload {
  id: string;
  vehicleId: string;
}

interface ServerToClientEvents {
  "telemetry:updated": (reading: LiveTelemetryEvent) => void;
}

interface ClientToServerEvents {
  "vehicle:join": (vehicleId: string) => void;
  "vehicle:leave": (vehicleId: string) => void;
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
