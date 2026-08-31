import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import {
  acknowledgeAlert,
  getAlerts,
} from "../api/alerts";
import { socket } from "../socket";
import type {
  AlertSeverity,
  AlertStatus,
  VehicleAlert,
} from "../types/alert";

import "../App.css";

type StatusFilter = "ALL" | AlertStatus;
type SeverityFilter = "ALL" | AlertSeverity;

function formatValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function AlertsPage() {
  const [alerts, setAlerts] =
    useState<VehicleAlert[]>([]);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("ALL");

  const [vehicleFilter, setVehicleFilter] =
    useState("ALL");

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [acknowledgingId, setAcknowledgingId] =
    useState<string | null>(null);

  async function loadAlerts(): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await getAlerts();

      setAlerts(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load alerts.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAcknowledge(
    alertId: string,
  ): Promise<void> {
    try {
      setAcknowledgingId(alertId);

      const updated =
        await acknowledgeAlert(alertId);

      setAlerts((current) =>
        current.map((alert) =>
          alert.id === updated.id
            ? {
                ...alert,
                ...updated,
              }
            : alert,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to acknowledge alert.",
      );
    } finally {
      setAcknowledgingId(null);
    }
  }

  useEffect(() => {
    void loadAlerts();

    function handleAlertChange(): void {
      void loadAlerts();
    }

    socket.connect();
    socket.emit("fleet:join");

    socket.on(
      "alert:created",
      handleAlertChange,
    );

    socket.on(
      "alert:updated",
      handleAlertChange,
    );

    socket.on(
      "alert:resolved",
      handleAlertChange,
    );

    return () => {
      socket.emit("fleet:leave");

      socket.off(
        "alert:created",
        handleAlertChange,
      );

      socket.off(
        "alert:updated",
        handleAlertChange,
      );

      socket.off(
        "alert:resolved",
        handleAlertChange,
      );

      socket.disconnect();
    };
  }, []);

  const vehicles = useMemo(() => {
    return Array.from(
      new Map(
        alerts.map((alert) => [
          alert.vehicleId,
          alert.vehicle.vehicleCode,
        ]),
      ).entries(),
    );
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (
        statusFilter !== "ALL" &&
        alert.status !== statusFilter
      ) {
        return false;
      }

      if (
        severityFilter !== "ALL" &&
        alert.severity !== severityFilter
      ) {
        return false;
      }

      if (
        vehicleFilter !== "ALL" &&
        alert.vehicleId !== vehicleFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    alerts,
    severityFilter,
    statusFilter,
    vehicleFilter,
  ]);

  const activeCount = alerts.filter(
    (alert) => alert.status === "ACTIVE",
  ).length;

  const acknowledgedCount = alerts.filter(
    (alert) => alert.status === "ACKNOWLEDGED",
  ).length;

  const resolvedCount = alerts.filter(
    (alert) => alert.status === "RESOLVED",
  ).length;

  return (
    <main className="alerts-page">
      <Link className="back-link" to="/">
        {"\u2190"} Fleet overview
      </Link>

      <header className="page-header">
        <div>
          <p className="eyebrow">
            Fleet monitoring
          </p>

          <h1>Alerts</h1>

          <p className="page-description">
            Review active faults, acknowledged incidents
            and resolved vehicle alerts.
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={() => void loadAlerts()}
          disabled={isLoading}
        >
          {isLoading
            ? "Refreshing..."
            : "Refresh alerts"}
        </button>
      </header>

      <section className="alert-stat-grid">
        <article className="stat-card">
          <span className="stat-label">
            Total alerts
          </span>
          <strong>{alerts.length}</strong>
          <span className="stat-note">
            Recorded incidents
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Active
          </span>
          <strong>{activeCount}</strong>
          <span className="stat-note">
            Require attention
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Acknowledged
          </span>
          <strong>{acknowledgedCount}</strong>
          <span className="stat-note">
            Seen by operator
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Resolved
          </span>
          <strong>{resolvedCount}</strong>
          <span className="stat-note">
            Returned to normal
          </span>
        </article>
      </section>

      <section className="alerts-filter-panel">
        <div>
          <label htmlFor="status-filter">
            Status
          </label>

          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as StatusFilter,
              )
            }
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ACKNOWLEDGED">
              Acknowledged
            </option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div>
          <label htmlFor="severity-filter">
            Severity
          </label>

          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(
                event.target.value as SeverityFilter,
              )
            }
          >
            <option value="ALL">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
        </div>

        <div>
          <label htmlFor="vehicle-filter">
            Vehicle
          </label>

          <select
            id="vehicle-filter"
            value={vehicleFilter}
            onChange={(event) =>
              setVehicleFilter(event.target.value)
            }
          >
            <option value="ALL">All vehicles</option>

            {vehicles.map(
              ([vehicleId, vehicleCode]) => (
                <option
                  key={vehicleId}
                  value={vehicleId}
                >
                  {vehicleCode}
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      {errorMessage && (
        <div
          className="error-message"
          role="alert"
        >
          <div>
            <strong>
              Unable to load alert data
            </strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <section className="alerts-table-panel">
        <div className="panel-header alerts-panel-header">
          <div>
            <h2>Alert history</h2>

            <p>
              Showing {filteredAlerts.length} of{" "}
              {alerts.length} alerts.
            </p>
          </div>
        </div>

        {isLoading && alerts.length === 0 ? (
          <div className="empty-state">
            <div className="loading-spinner" />
            <p>Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="alerts-empty">
            <strong>No matching alerts</strong>
            <span>
              Try changing the selected filters.
            </span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Alert</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Triggered</th>
                  <th>Resolved</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <Link
                        className="vehicle-link"
                        to={`/vehicles/${alert.vehicleId}`}
                      >
                        {alert.vehicle.vehicleCode}
                      </Link>
                    </td>

                    <td>
                      <div className="alert-table-description">
                        <strong>
                          {formatValue(alert.type)}
                        </strong>

                        <span>{alert.message}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`alert-severity severity-${alert.severity.toLowerCase()}`}
                      >
                        {formatValue(alert.severity)}
                      </span>
                    </td>

                    <td>
                      <span className="alert-status">
                        {formatValue(alert.status)}
                      </span>
                    </td>

                    <td>
                      {formatDate(alert.triggeredAt)}
                    </td>

                    <td>
                      {alert.resolvedAt
                        ? formatDate(
                            alert.resolvedAt,
                          )
                        : "\u2014"}
                    </td>

                    <td>
                      {alert.status === "ACTIVE" ? (
                        <button
                          className="acknowledge-button"
                          type="button"
                          disabled={
                            acknowledgingId ===
                            alert.id
                          }
                          onClick={() =>
                            void handleAcknowledge(
                              alert.id,
                            )
                          }
                        >
                          {acknowledgingId ===
                          alert.id
                            ? "Acknowledging..."
                            : "Acknowledge"}
                        </button>
                      ) : (
                        <span className="no-action">
                          {"\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
