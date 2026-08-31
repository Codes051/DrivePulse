import "dotenv/config";

import { createServer } from "node:http";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import {
  startMqttClient,
  stopMqttClient,
} from "./mqtt/mqtt.client.js";
import {
  startSocketServer,
  stopSocketServer,
} from "./realtime/socket.server.js";
import {
  checkTelemetryTimeouts,
} from "./services/telemetry-watchdog.service.js";

const portValue = Number(process.env.PORT ?? 3000);

const WATCHDOG_INTERVAL_MS = 5_000;

if (
  !Number.isInteger(portValue) ||
  portValue <= 0 ||
  portValue > 65_535
) {
  throw new Error(
    "PORT must be a valid integer between 1 and 65535.",
  );
}

const httpServer = createServer(app);

startSocketServer(httpServer);
startMqttClient();

async function runTelemetryWatchdog(): Promise<void> {
  try {
    await checkTelemetryTimeouts();
  } catch (error) {
    console.error(
      "Telemetry watchdog check failed:",
      error,
    );
  }
}

const watchdogTimer = setInterval(() => {
  void runTelemetryWatchdog();
}, WATCHDOG_INTERVAL_MS);

void runTelemetryWatchdog();

httpServer.listen(portValue, () => {
  console.log(
    `DrivePulse API running at http://localhost:${portValue}`,
  );

  console.log(
    "Telemetry watchdog active: 30 second timeout.",
  );
});

let isShuttingDown = false;

async function shutDown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\nReceived ${signal}. Shutting down...`,
  );

  clearInterval(watchdogTimer);

  httpServer.close(async (error) => {
    if (error) {
      console.error(
        "Failed to close the HTTP server:",
        error,
      );

      process.exit(1);
    }

    try {
      await stopMqttClient();
      await stopSocketServer();
      await prisma.$disconnect();

      console.log(
        "Telemetry watchdog stopped.",
      );
      console.log(
        "Database connection closed.",
      );
      console.log(
        "HTTP server closed.",
      );

      process.exit(0);
    } catch (shutdownError) {
      console.error(
        "Shutdown failed:",
        shutdownError,
      );

      process.exit(1);
    }
  });
}

process.on("SIGINT", () => {
  void shutDown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutDown("SIGTERM");
});
