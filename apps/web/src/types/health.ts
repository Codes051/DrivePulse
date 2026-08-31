export type HealthCondition =
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR";

export interface VehicleHealth {
  vehicleId: string;
  score: number;
  condition: HealthCondition;
  calculatedAt: string;
  factors: {
    temperaturePenalty: number;
    vibrationPenalty: number;
    batteryVoltagePenalty: number;
    batteryPercentagePenalty: number;
    alertPenalty: number;
    telemetryFreshnessPenalty: number;
  };
}
