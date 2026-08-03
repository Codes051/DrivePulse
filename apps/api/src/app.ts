import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { prisma } from "./lib/prisma.js";
import { vehiclesRouter } from "./routes/vehicles.routes.js";
import { telemetryRouter } from "./routes/telemetry.routes.js";

export const app = express();

app.set("json replacer", (_key: string, value: unknown) => {
  return typeof value === "bigint" ? value.toString() : value;
});

app.disable("x-powered-by");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api/vehicles", vehiclesRouter);
app.use("/api/vehicles/:id/telemetry", telemetryRouter);

app.get("/", (_request: Request, response: Response) => {
  response.status(200).json({
    name: "DrivePulse API",
    message: "Connected vehicle telemetry platform",
  });
});

app.get("/health", (_request: Request, response: Response) => {
  response.status(200).json({
    status: "ok",
    service: "drivepulse-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get(
  "/health/database",
  async (_request: Request, response: Response, next: NextFunction) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      response.status(200).json({
        status: "ok",
        service: "postgresql",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use((_request: Request, response: Response) => {
  response.status(404).json({
    error: "Route not found",
  });
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error("Unhandled application error:", error);

    response.status(500).json({
      error: "Internal server error",
    });
  },
);


