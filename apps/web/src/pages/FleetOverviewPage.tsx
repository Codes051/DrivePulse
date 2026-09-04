import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router";

import { acknowledgeAlert, getAlerts } from "../api/alerts";
import {
  createVehicle,
  fetchVehicles,
} from "../api";
import { socket } from "../socket";
import type { VehicleAlert } from "../types/alert";
import type { Vehicle, VehicleStatus } from "../types";

import "../App.css";

function formatStatus(status: VehicleStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatAlertValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function formatDate(dateValue: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function getStatusClass(status: VehicleStatus): string {
  return `status-badge status-${status.toLowerCase()}`;
}

export function FleetOverviewPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledgingAlertId, setAcknowledgingAlertId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [isAddVehicleOpen, setIsAddVehicleOpen] =
    useState(false);

  const [isCreatingVehicle, setIsCreatingVehicle] =
    useState(false);

  const [vehicleFormError, setVehicleFormError] =
    useState<string | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    vehicleCode: "",
    manufacturer: "",
    model: "",
    year: String(new Date().getFullYear()),
  });

  async function loadDashboard(
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [vehicleResult, alertResult] = await Promise.all([
        fetchVehicles(signal),
        getAlerts(),
      ]);

      if (signal?.aborted) {
        return;
      }

      setVehicles(vehicleResult.vehicles);
      setAlerts(alertResult);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  async function handleCreateVehicle(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsCreatingVehicle(true);
      setVehicleFormError(null);

      const yearValue = newVehicle.year.trim();

      const createdVehicle = await createVehicle({
        vehicleCode: newVehicle.vehicleCode,
        manufacturer: newVehicle.manufacturer,
        model: newVehicle.model,
        ...(yearValue
          ? {
              year: Number(yearValue),
            }
          : {}),
      });

      setVehicles((currentVehicles) =>
        [...currentVehicles, createdVehicle].sort(
          (left, right) =>
            left.vehicleCode.localeCompare(
              right.vehicleCode,
            ),
        ),
      );

      setNewVehicle({
        vehicleCode: "",
        manufacturer: "",
        model: "",
        year: String(new Date().getFullYear()),
      });

      setIsAddVehicleOpen(false);
    } catch (error) {
      setVehicleFormError(
        error instanceof Error
          ? error.message
          : "Unable to create vehicle.",
      );
    } finally {
      setIsCreatingVehicle(false);
    }
  }

  async function handleAcknowledge(
    alertId: string,
  ): Promise<void> {
    try {
      setAcknowledgingAlertId(alertId);
      setErrorMessage(null);

      const updatedAlert = await acknowledgeAlert(alertId);

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) =>
          alert.id === updatedAlert.id
            ? {
                ...alert,
                ...updatedAlert,
              }
            : alert,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to acknowledge the alert.",
      );
    } finally {
      setAcknowledgingAlertId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboard(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  const activeAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "ACTIVE" ||
          alert.status === "ACKNOWLEDGED",
      ),
    [alerts],
  );

  useEffect(() => {
    function handleFleetAlertChange(): void {
      void loadDashboard();
    }

    socket.connect();
    socket.emit("fleet:join");

    socket.on(
      "alert:created",
      handleFleetAlertChange,
    );

    socket.on(
      "alert:updated",
      handleFleetAlertChange,
    );

    socket.on(
      "alert:resolved",
      handleFleetAlertChange,
    );

    return () => {
      socket.emit("fleet:leave");

      socket.off(
        "alert:created",
        handleFleetAlertChange,
      );

      socket.off(
        "alert:updated",
        handleFleetAlertChange,
      );

      socket.off(
        "alert:resolved",
        handleFleetAlertChange,
      );

      socket.disconnect();
    };
  }, []);

  const statistics = useMemo(() => {
    return {
      total: vehicles.length,
      online: vehicles.filter(
        (vehicle) => vehicle.status === "ONLINE",
      ).length,
      warning: vehicles.filter(
        (vehicle) => vehicle.status === "WARNING",
      ).length,
      offline: vehicles.filter(
        (vehicle) => vehicle.status === "OFFLINE",
      ).length,
    };
  }, [vehicles]);

  return (
    <div className="fleet-oem">
      <header className="fleet-oem-header">
        <div>
          <p className="fleet-oem-kicker">
            Fleet / Live
          </p>

          <h1>Fleet Overview</h1>

          <p>
            Real-time vehicle status, connectivity
            and operating conditions.
          </p>
        </div>

        <div className="fleet-oem-actions">
          <button
            className="fleet-oem-secondary-button"
            type="button"
            onClick={() =>
              void loadDashboard()
            }
            disabled={isLoading}
          >
            {isLoading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            className="fleet-oem-primary-button"
            type="button"
            onClick={() => {
              setVehicleFormError(null);
              setIsAddVehicleOpen(true);
            }}
          >
            Add vehicle
          </button>
        </div>
      </header>

      {isAddVehicleOpen && (
        <div className="vehicle-modal-backdrop">
          <div
            className="vehicle-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-vehicle-title"
          >
            <div className="vehicle-modal-header">
              <div>
                <p className="fleet-oem-kicker">
                  Fleet management
                </p>

                <h2 id="add-vehicle-title">
                  Add vehicle
                </h2>

                <p>
                  Register a vehicle in DrivePulse.
                  It will remain offline until
                  telemetry is received.
                </p>
              </div>

              <button
                className="vehicle-modal-close"
                type="button"
                aria-label="Close"
                onClick={() =>
                  setIsAddVehicleOpen(false)
                }
              >
                {"\u00D7"}
              </button>
            </div>

            <form
              className="vehicle-form"
              onSubmit={(event) =>
                void handleCreateVehicle(event)
              }
            >
              <label>
                Vehicle code

                <input
                  required
                  minLength={2}
                  maxLength={30}
                  placeholder="CAR-002"
                  value={newVehicle.vehicleCode}
                  onChange={(event) =>
                    setNewVehicle(
                      (current) => ({
                        ...current,
                        vehicleCode:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Manufacturer

                <input
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="BMW"
                  value={newVehicle.manufacturer}
                  onChange={(event) =>
                    setNewVehicle(
                      (current) => ({
                        ...current,
                        manufacturer:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Model

                <input
                  required
                  maxLength={80}
                  placeholder="M3 Competition"
                  value={newVehicle.model}
                  onChange={(event) =>
                    setNewVehicle(
                      (current) => ({
                        ...current,
                        model:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Model year

                <input
                  type="number"
                  min="1886"
                  max={
                    new Date().getFullYear() + 1
                  }
                  value={newVehicle.year}
                  onChange={(event) =>
                    setNewVehicle(
                      (current) => ({
                        ...current,
                        year:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              {vehicleFormError && (
                <div className="vehicle-form-error">
                  {vehicleFormError}
                </div>
              )}

              <div className="vehicle-form-actions">
                <button
                  className="vehicle-form-cancel"
                  type="button"
                  disabled={isCreatingVehicle}
                  onClick={() =>
                    setIsAddVehicleOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className="vehicle-form-submit"
                  type="submit"
                  disabled={isCreatingVehicle}
                >
                  {isCreatingVehicle
                    ? "Adding..."
                    : "Add vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="fleet-oem-summary">
        <article className="fleet-oem-total">
          <span>Connected fleet</span>

          <strong>
            {statistics.total
              .toString()
              .padStart(2, "0")}
          </strong>

          <p>
            Vehicles registered in DrivePulse
          </p>
        </article>

        <div className="fleet-oem-status-grid">
          <article>
            <span className="fleet-oem-status-light status-light-online" />

            <div>
              <strong>
                {statistics.online
                  .toString()
                  .padStart(2, "0")}
              </strong>

              <span>Online</span>
            </div>
          </article>

          <article>
            <span className="fleet-oem-status-light status-light-warning" />

            <div>
              <strong>
                {statistics.warning
                  .toString()
                  .padStart(2, "0")}
              </strong>

              <span>Attention</span>
            </div>
          </article>

          <article>
            <span className="fleet-oem-status-light status-light-offline" />

            <div>
              <strong>
                {statistics.offline
                  .toString()
                  .padStart(2, "0")}
              </strong>

              <span>Offline</span>
            </div>
          </article>
        </div>
      </section>

      {errorMessage && (
        <div
          className="fleet-oem-error"
          role="alert"
        >
          <div>
            <strong>
              Connection interrupted
            </strong>

            <span>{errorMessage}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadDashboard()
            }
          >
            Retry
          </button>
        </div>
      )}

      <section className="fleet-oem-condition">
        <div className="fleet-oem-section-header">
          <div>
            <span>
              Current condition
            </span>

            <h2>Active Alerts</h2>
          </div>

          <strong>
            {activeAlerts.length
              .toString()
              .padStart(2, "0")}
          </strong>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="fleet-oem-all-clear">
            <span className="fleet-oem-all-clear-dot" />

            <div>
              <strong>
                All systems nominal
              </strong>

              <p>
                No active vehicle faults require
                attention.
              </p>
            </div>

            <span className="fleet-oem-all-clear-label">
              All clear
            </span>
          </div>
        ) : (
          <div className="fleet-oem-alert-list">
            {activeAlerts.map((alert) => (
              <article
                className="fleet-oem-alert-row"
                key={alert.id}
              >
                <span
                  className={`fleet-oem-alert-marker alert-marker-${alert.severity.toLowerCase()}`}
                />

                <div className="fleet-oem-alert-main">
                  <div>
                    <strong>
                      {formatAlertValue(
                        alert.type,
                      )}
                    </strong>

                    <span>
                      {alert.message}
                    </span>
                  </div>

                  <div className="fleet-oem-alert-meta">
                    <Link
                      to={`/vehicles/${alert.vehicleId}`}
                    >
                      {
                        alert.vehicle
                          .vehicleCode
                      }
                    </Link>

                    <span>
                      {formatDate(
                        alert.triggeredAt,
                      )}
                    </span>
                  </div>
                </div>

                {alert.status === "ACTIVE" && (
                  <button
                    className="fleet-oem-ack-button"
                    type="button"
                    disabled={
                      acknowledgingAlertId ===
                      alert.id
                    }
                    onClick={() =>
                      void handleAcknowledge(
                        alert.id,
                      )
                    }
                  >
                    {acknowledgingAlertId ===
                    alert.id
                      ? "Working..."
                      : "Acknowledge"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="fleet-oem-vehicles">
        <div className="fleet-oem-section-header">
          <div>
            <span>Garage</span>
            <h2>Vehicles</h2>
          </div>

          <strong>
            {vehicles.length
              .toString()
              .padStart(2, "0")}
          </strong>
        </div>

        {isLoading &&
        vehicles.length === 0 ? (
          <div className="fleet-oem-empty">
            Loading fleet...
          </div>
        ) : !isLoading &&
          !errorMessage &&
          vehicles.length === 0 ? (
          <div className="fleet-oem-empty">
            <strong>
              No vehicles registered
            </strong>

            <span>
              Add your first vehicle to begin
              receiving telemetry.
            </span>
          </div>
        ) : (
          <div className="fleet-oem-vehicle-list">
            {vehicles.map((vehicle) => (
              <article
                className="fleet-oem-vehicle-row"
                key={vehicle.id}
              >
                <div className="fleet-oem-vehicle-main">
                  <span className="fleet-oem-vehicle-code">
                    {vehicle.vehicleCode}
                  </span>

                  <div>
                    <strong>
                      {vehicle.manufacturer}{" "}
                      {vehicle.model}
                    </strong>

                    <span>
                      {vehicle.year ??
                        "Year not specified"}
                    </span>
                  </div>
                </div>

                <div className="fleet-oem-vehicle-status">
                  <span
                    className={getStatusClass(
                      vehicle.status,
                    )}
                  >
                    <span className="status-dot" />
                    {formatStatus(
                      vehicle.status,
                    )}
                  </span>
                </div>

                <div className="fleet-oem-vehicle-updated">
                  <span>Updated</span>

                  <strong>
                    {formatDate(
                      vehicle.updatedAt,
                    )}
                  </strong>
                </div>

                <Link
                  className="fleet-oem-open"
                  to={`/vehicles/${vehicle.id}`}
                  aria-label={`Open ${vehicle.vehicleCode}`}
                >
                  {"\u2192"}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}