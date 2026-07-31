import "dotenv/config";

import { app } from "./app.js";

const portValue = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(portValue) || portValue <= 0 || portValue > 65_535) {
  throw new Error("PORT must be a valid integer between 1 and 65535.");
}

const server = app.listen(portValue, () => {
  console.log(`DrivePulse API running at http://localhost:${portValue}`);
});

function shutDown(signal: string): void {
  console.log(`\nReceived ${signal}. Shutting down...`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close the HTTP server:", error);
      process.exit(1);
    }

    console.log("HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutDown("SIGINT"));
process.on("SIGTERM", () => shutDown("SIGTERM"));