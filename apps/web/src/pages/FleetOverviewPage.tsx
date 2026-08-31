import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { acknowledgeAlert, getAlerts } from "../api/alerts";
import { fetchVehicles } from "../api";
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DP</div>

          <div>
            <div className="brand-name">DrivePulse</div>
            <div className="brand-subtitle">
              Fleet Intelligence
            </div>
          </div>
        </div>

        <nav
          className="navigation"
          aria-label="Main navigation"
        >
          <button
            className="nav-item nav-item-active"
            type="button"
          >
            Fleet Overview
          </button>

          <button
            className="nav-item"
            type="button"
            disabled
          >
            Vehicle Analytics
          </button>

          <Link
            className="nav-item nav-link"
            to="/alerts"
          >
            Alerts
          </Link>

          <button
            className="nav-item"
            type="button"
            disabled
          >
            Maintenance
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="system-indicator" />
          Platform operational
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              Connected vehicle platform
            </p>
            <h1>Fleet overview</h1>
            <p className="page-description">
              Monitor vehicle connectivity, operational status,
              incoming telemetry and active alerts.
            </p>
          </div>

          <button
            className="refresh-button"
            type="button"
            onClick={() => void loadDashboard()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh data"}
          </button>
        </header>

        <section
          className="stat-grid"
          aria-label="Fleet statistics"
        >
          <article className="stat-card">
            <span className="stat-label">Total vehicles</span>
            <strong>{statistics.total}</strong>
            <span className="stat-note">
              Registered in DrivePulse
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Online</span>
            <strong>{statistics.online}</strong>
            <span className="stat-note">
              Sending telemetry
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Warnings</span>
            <strong>{statistics.warning}</strong>
            <span className="stat-note">
              Require attention
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Offline</span>
            <strong>{statistics.offline}</strong>
            <span className="stat-note">
              Not currently connected
            </span>
          </article>
        </section>

        {errorMessage && (
          <div className="error-message" role="alert">
            <div>
              <strong>Dashboard request failed</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard()}
            >
              Try again
            </button>
          </div>
        )}

        <section className="alerts-panel">
          <div className="panel-header alerts-panel-header">
            <div>
              <h2>Active alerts</h2>
              <p>
                Current vehicle conditions requiring attention.
              </p>
            </div>

            <span className="alerts-count">
              {activeAlerts.length}
            </span>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="alerts-empty">
              <strong>No active alerts</strong>
              <span>
                All monitored vehicles are operating normally.
              </span>
            </div>
          ) : (
            <div className="alert-list">
              {activeAlerts.map((alert) => (
                <article
                  className={`alert-item alert-${alert.severity.toLowerCase()}`}
                  key={alert.id}
                >
                  <div className="alert-content">
                    <div className="alert-heading">
                      <span
                        className={`alert-severity severity-${alert.severity.toLowerCase()}`}
                      >
                        {formatAlertValue(alert.severity)}
                      </span>

                      <span className="alert-status">
                        {formatAlertValue(alert.status)}
                      </span>
                    </div>

                    <h3>{formatAlertValue(alert.type)}</h3>
                    <p>{alert.message}</p>

                    <div className="alert-metadata">
                      <Link
                        to={`/vehicles/${alert.vehicleId}`}
                      >
                        {alert.vehicle.vehicleCode}
                      </Link>

                      <span>
                        Triggered{" "}
                        {formatDate(alert.triggeredAt)}
                      </span>
                    </div>
                  </div>

                  {alert.status === "ACTIVE" && (
                    <button
                      className="acknowledge-button"
                      type="button"
                      onClick={() =>
                        void handleAcknowledge(alert.id)
                      }
                      disabled={
                        acknowledgingAlertId === alert.id
                      }
                    >
                      {acknowledgingAlertId === alert.id
                        ? "Acknowledging..."
                        : "Acknowledge"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="fleet-panel">
          <div className="panel-header">
            <div>
              <h2>Registered vehicles</h2>
              <p>
                Vehicles currently configured in the DrivePulse
                platform.
              </p>
            </div>
          </div>

          {isLoading && vehicles.length === 0 && (
            <div className="empty-state">
              <div className="loading-spinner" />
              <p>Loading vehicle information...</p>
            </div>
          )}

          {!isLoading &&
            !errorMessage &&
            vehicles.length === 0 && (
              <div className="empty-state">
                <h3>No vehicles registered</h3>
                <p>
                  Create a vehicle through the API to make it
                  appear here.
                </p>
              </div>
            )}

          {vehicles.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Last updated</th>
                  </tr>
                </thead>

                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <div className="vehicle-identity">
                          <span className="vehicle-icon">V</span>

                          <div>
                            <Link
                              className="vehicle-link"
                              to={`/vehicles/${vehicle.id}`}
                            >
                              {vehicle.vehicleCode}
                            </Link>

                            <span>{vehicle.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td>{vehicle.manufacturer}</td>
                      <td>{vehicle.model}</td>
                      <td>
                        {vehicle.year ?? "\u2014"}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            vehicle.status,
                          )}
                        >
                          <span className="status-dot" />
                          {formatStatus(vehicle.status)}
                        </span>
                      </td>

                      <td>
                        {formatDate(vehicle.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
