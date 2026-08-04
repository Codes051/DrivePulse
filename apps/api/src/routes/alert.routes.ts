import { Router } from "express";
import {
  acknowledgeAlert,
  getAlerts,
} from "../controllers/alert.controller.js";

export const alertRouter = Router();

alertRouter.get("/", getAlerts);
alertRouter.patch("/:id/acknowledge", acknowledgeAlert);
