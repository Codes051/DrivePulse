import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import {
  startMqttClient,
  stopMqttClient,
} from "./mqtt/mqtt.client.js";

const portValue = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(portValue) || portValue <= 0 || portValue > 65_535) {
  throw new Error("PORT must be a valid integer between 1 and 65535.");
}

startMqttClient();

const server = app.listen(portValue, () => {
  console.log(`DrivePulse API running at http://localhost:${portValue}`);
});

let isShuttingDown = false;

async function shutDown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Shutting down...`);

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close the HTTP server:", error);
      process.exit(1);
    }

    try {
      await stopMqttClient();
      await prisma.$disconnect();

      console.log("Database connection closed.");
      console.log("HTTP server closed.");
      process.exit(0);
    } catch (shutdownError) {
      console.error("Shutdown failed:", shutdownError);
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
