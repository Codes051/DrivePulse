import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router";

import {
  fetchLatestTelemetry,
  fetchVehicles,
} from "../api";

import {
  getSimulationHealth,
  getSimulationStatus,
  setSimulationScenario,
  startSimulation,
  stopSimulation,
  type SimulationHealth,
  type SimulationScenario,
  type SimulationStatus,
} from "../api/simulation";

import type {
  LatestTelemetryResponse,
  Vehicle,
} from "../types";

import "../App.css";

function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "Ã¢â‚¬â€";
  }

  return value.toFixed(digits);
}

function scenarioLabel(
  scenario: SimulationScenario,
): string {
  switch (scenario) {
    case "high-temperature":
      return "High temperature";

    case "low-battery":
      return "Low battery";

    case "vibration":
      return "Excessive vibration";

    default:
      return "Normal driving";
  }
}

export function SimulationLabPage() {
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [
    selectedVehicleCode,
    setSelectedVehicleCode,
  ] = useState("");

  const [
    simulationStatus,
    setSimulationStatus,
  ] =
    useState<SimulationStatus | null>(
      null,
    );

  const [
    serviceHealth,
    setServiceHealth,
  ] =
    useState<SimulationHealth | null>(
      null,
    );

  const [
    latest,
    setLatest,
  ] =
    useState<LatestTelemetryResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [actionName, setActionName] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) =>
          vehicle.vehicleCode ===
          selectedVehicleCode,
      ) ?? null,
    [vehicles, selectedVehicleCode],
  );

  const loadInitialData = useCallback(
    async (): Promise<void> => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [
          vehicleResult,
          healthResult,
        ] = await Promise.all([
          fetchVehicles(),
          getSimulationHealth(),
        ]);

        setVehicles(
          vehicleResult.vehicles,
        );

        setServiceHealth(
          healthResult,
        );

        setSelectedVehicleCode(
          (current) => {
            if (
              current ||
              vehicleResult.vehicles.length === 0
            ) {
              return current;
            }

            return vehicleResult
              .vehicles[0]
              .vehicleCode;
          },
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Simulation Lab.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const refreshSelected = useCallback(
    async (): Promise<void> => {
      if (!selectedVehicle) {
        return;
      }

      try {
        const [
          statusResult,
          telemetryResult,
          healthResult,
        ] = await Promise.all([
          getSimulationStatus(
            selectedVehicle.vehicleCode,
          ),

          fetchLatestTelemetry(
            selectedVehicle.id,
          ),

          getSimulationHealth(),
        ]);

        setSimulationStatus(
          statusResult,
        );

        setLatest(
          telemetryResult,
        );

        setServiceHealth(
          healthResult,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to refresh simulation.",
        );
      }
    },
    [selectedVehicle],
  );

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedVehicle) {
      return;
    }

    void refreshSelected();

    const interval = window.setInterval(
      () => {
        void refreshSelected();
      },
      2000,
    );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    refreshSelected,
    selectedVehicle,
  ]);

  async function runAction(
    name: string,
    action: () =>
      Promise<SimulationStatus>,
  ): Promise<void> {
    try {
      setActionName(name);
      setErrorMessage(null);

      const result = await action();

      setSimulationStatus(result);

      window.setTimeout(
        () => {
          void refreshSelected();
        },
        800,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Simulation command failed.",
      );
    } finally {
      setActionName(null);
    }
  }

  function changeScenario(
    scenario: SimulationScenario,
  ): void {
    if (!selectedVehicle) {
      return;
    }

    void runAction(
      scenario,
      () =>
        setSimulationScenario(
          selectedVehicle.vehicleCode,
          scenario,
        ),
    );
  }

  const telemetry =
    latest?.telemetry ?? null;

  return (
    <div className="simulation-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Interactive demo environment
          </p>

          <h1>Simulation Lab</h1>

          <p className="page-description">
            Generate live vehicle telemetry and
            fault conditions without using
            external scripts or terminal commands.
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={() =>
            void refreshSelected()
          }
          disabled={isLoading}
        >
          Refresh
        </button>
      </header>

      {errorMessage && (
        <div
          className="error-message"
          role="alert"
        >
          <div>
            <strong>
              Simulation Lab error
            </strong>

            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <section className="simulation-service-panel">
        <div>
          <span className="simulation-label">
            Simulation service
          </span>

          <strong>
            {serviceHealth?.status === "ok"
              ? "Operational"
              : "Unavailable"}
          </strong>
        </div>

        <div>
          <span className="simulation-label">
            MQTT broker
          </span>

          <strong
            className={
              serviceHealth?.mqttConnected
                ? "simulation-good"
                : "simulation-bad"
            }
          >
            {serviceHealth?.mqttConnected
              ? "Connected"
              : "Disconnected"}
          </strong>
        </div>

        <div>
          <span className="simulation-label">
            Active simulations
          </span>

          <strong>
            {serviceHealth?.simulations.filter(
              (simulation) =>
                simulation.running,
            ).length ?? 0}
          </strong>
        </div>
      </section>

      <section className="simulation-control-panel">
        <div className="panel-header">
          <div>
            <h2>Vehicle control</h2>

            <p>
              Select a registered DrivePulse
              vehicle and choose its operating
              condition.
            </p>
          </div>
        </div>

        <div className="simulation-selector">
          <label htmlFor="simulation-vehicle">
            Vehicle
          </label>

          <select
            id="simulation-vehicle"
            value={selectedVehicleCode}
            onChange={(event) =>
              setSelectedVehicleCode(
                event.target.value,
              )
            }
          >
            {vehicles.length === 0 && (
              <option value="">
                No registered vehicles
              </option>
            )}

            {vehicles.map(
              (vehicle) => (
                <option
                  key={vehicle.id}
                  value={
                    vehicle.vehicleCode
                  }
                >
                  {vehicle.vehicleCode} -{" "}
                  {vehicle.manufacturer}{" "}
                  {vehicle.model}
                </option>
              ),
            )}
          </select>
        </div>

        {selectedVehicle && (
          <>
            <div className="simulation-current-state">
              <div>
                <span>
                  Simulation
                </span>

                <strong
                  className={
                    simulationStatus?.running
                      ? "simulation-good"
                      : ""
                  }
                >
                  {simulationStatus?.running
                    ? "Running"
                    : "Stopped"}
                </strong>
              </div>

              <div>
                <span>
                  Current scenario
                </span>

                <strong>
                  {simulationStatus
                    ? scenarioLabel(
                        simulationStatus
                          .scenario,
                      )
                    : "Ã¢â‚¬â€"}
                </strong>
              </div>

              <div>
                <span>
                  Vehicle
                </span>

                <strong>
                  {
                    selectedVehicle
                      .vehicleCode
                  }
                </strong>
              </div>
            </div>

            <div className="simulation-actions">
              <button
                className="simulation-action simulation-normal"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  void runAction(
                    "start",
                    () =>
                      startSimulation(
                        selectedVehicle
                          .vehicleCode,
                      ),
                  )
                }
              >
                <strong>
                  Start normal driving
                </strong>

                <span>
                  Generate healthy telemetry
                </span>
              </button>

              <button
                className="simulation-action"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  changeScenario(
                    "high-temperature",
                  )
                }
              >
                <strong>
                  High temperature
                </strong>

                <span>
                  Trigger cooling-system risk
                </span>
              </button>

              <button
                className="simulation-action"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  changeScenario(
                    "low-battery",
                  )
                }
              >
                <strong>
                  Low battery
                </strong>

                <span>
                  Trigger battery warnings
                </span>
              </button>

              <button
                className="simulation-action"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  changeScenario(
                    "vibration",
                  )
                }
              >
                <strong>
                  Excessive vibration
                </strong>

                <span>
                  Trigger vibration fault
                </span>
              </button>

              <button
                className="simulation-action simulation-stop"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  void runAction(
                    "stop",
                    () =>
                      stopSimulation(
                        selectedVehicle
                          .vehicleCode,
                      ),
                  )
                }
              >
                <strong>
                  Stop telemetry
                </strong>

                <span>
                  Simulate connection loss
                </span>
              </button>

              <button
                className="simulation-action"
                type="button"
                disabled={
                  actionName !== null
                }
                onClick={() =>
                  changeScenario(
                    "normal",
                  )
                }
              >
                <strong>
                  Restore normal
                </strong>

                <span>
                  Return vehicle to healthy data
                </span>
              </button>
            </div>
          </>
        )}
      </section>

      <section className="simulation-telemetry-panel">
        <div className="panel-header">
          <div>
            <h2>Current telemetry</h2>

            <p>
              Latest values received through
              the MQTT telemetry pipeline.
            </p>
          </div>

          {selectedVehicle && (
            <Link
              className="vehicle-link"
              to={`/vehicles/${selectedVehicle.id}`}
            >
              Open vehicle analytics
            </Link>
          )}
        </div>

        {!telemetry ? (
          <div className="details-state">
            No telemetry has been received for
            this vehicle yet.
          </div>
        ) : (
          <div className="simulation-telemetry-grid">
            <article>
              <span>Speed</span>

              <strong>
                {formatNumber(
                  telemetry.speedKmh,
                )}{" "}
                <small>km/h</small>
              </strong>
            </article>

            <article>
              <span>Temperature</span>

              <strong>
                {formatNumber(
                  telemetry.temperatureC,
                )}{" "}
                <small>Ã‚Â°C</small>
              </strong>
            </article>

            <article>
              <span>Battery</span>

              <strong>
                {formatNumber(
                  telemetry.batteryPercentage,
                )}{" "}
                <small>%</small>
              </strong>
            </article>

            <article>
              <span>Voltage</span>

              <strong>
                {formatNumber(
                  telemetry.batteryVoltage,
                  2,
                )}{" "}
                <small>V</small>
              </strong>
            </article>

            <article>
              <span>Vibration</span>

              <strong>
                {formatNumber(
                  telemetry.vibration,
                  3,
                )}
              </strong>
            </article>

            <article>
              <span>RPM</span>

              <strong>
                {telemetry.rpm}
              </strong>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}