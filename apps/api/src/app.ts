import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

export const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

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