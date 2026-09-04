import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchLatestTelemetry,
  fetchTelemetryHistory,
} from "../api";
import {
  acknowledgeAlert,
  getAlerts,
} from "../api/alerts";
import { getVehicleHealth } from "../api/health";
import {
  socket,
  type LiveAlertEvent,
} from "../socket";
import type { VehicleAlert } from "../types/alert";
import type { VehicleHealth } from "../types/health";
import type {
  LatestTelemetryResponse,
  TelemetryReading,
} from "../types";

function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined) {
    return "\u2014";
  }

  return value.toFixed(digits);
}

function formatPenalty(value: number): string {
  return value === 0
    ? "0"
    : `-${value}`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatChartTime(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
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

export function VehicleDetailsPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();

  const [latest, setLatest] =
    useState<LatestTelemetryResponse | null>(null);

  const [history, setHistory] =
    useState<TelemetryReading[]>([]);

  const [alerts, setAlerts] =
    useState<VehicleAlert[]>([]);

  const [health, setHealth] =
    useState<VehicleHealth | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [acknowledgingAlertId, setAcknowledgingAlertId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function refreshHealth(
    currentVehicleId: string,
  ): Promise<void> {
    try {
      const result =
        await getVehicleHealth(
          currentVehicleId,
        );

      setHealth(result);
    } catch (error) {
      console.error(
        "Unable to refresh vehicle health:",
        error,
      );
    }
  }

  async function handleAcknowledge(
    alertId: string,
  ): Promise<void> {
    try {
      setAcknowledgingAlertId(alertId);
      setErrorMessage(null);

      const updatedAlert =
        await acknowledgeAlert(alertId);

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                ...updatedAlert,
                vehicle: alert.vehicle,
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
      setAcknowledgingAlertId(null);
    }
  }

  useEffect(() => {
    if (!vehicleId) {
      setErrorMessage("Vehicle ID is missing.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadData(): Promise<void> {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [
          latestResult,
          historyResult,
          alertResult,
          healthResult,
        ] = await Promise.all([
          fetchLatestTelemetry(
            vehicleId!,
            controller.signal,
          ),
          fetchTelemetryHistory(
            vehicleId!,
            60,
            controller.signal,
          ),
          getAlerts({
            vehicleId: vehicleId!,
          }),
          getVehicleHealth(
            vehicleId!,
          ),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setLatest(latestResult);
        setHistory(historyResult.telemetry);
        setAlerts(alertResult);
        setHealth(healthResult);
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
            : "Unable to load vehicle telemetry.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      controller.abort();
    };
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId) {
      return;
    }

    function handleTelemetryUpdate(
      reading: TelemetryReading,
    ): void {
      if (reading.vehicleId !== vehicleId) {
        return;
      }

      setLatest((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          telemetry: reading,
        };
      });

      setHistory((current) => {
        const withoutDuplicate = current.filter(
          (existingReading) =>
            existingReading.id !== reading.id,
        );

        return [reading, ...withoutDuplicate].slice(
          0,
          60,
        );
      });

      void refreshHealth(vehicleId);
    }

    function handleAlertCreated(
      alert: LiveAlertEvent,
    ): void {
      if (alert.vehicleId !== vehicleId) {
        return;
      }

      setAlerts((current) => {
        const alreadyExists = current.some(
          (existing) => existing.id === alert.id,
        );

        if (alreadyExists) {
          return current.map((existing) =>
            existing.id === alert.id
              ? {
                  ...existing,
                  ...alert,
                  updatedAt: alert.lastObservedAt,
                }
              : existing,
          );
        }

        const vehicleCode =
          latest?.vehicle.vehicleCode ?? "";

        const newAlert: VehicleAlert = {
          ...alert,
          createdAt: alert.triggeredAt,
          updatedAt: alert.lastObservedAt,
          vehicle: {
            id: vehicleId,
            vehicleCode,
          },
        };

        return [newAlert, ...current];
      });

      void refreshHealth(vehicleId);
    }

    function handleAlertUpdated(
      alert: LiveAlertEvent,
    ): void {
      if (alert.vehicleId !== vehicleId) {
        return;
      }

      setAlerts((current) =>
        current.map((existing) =>
          existing.id === alert.id
            ? {
                ...existing,
                ...alert,
                updatedAt: alert.lastObservedAt,
              }
            : existing,
        ),
      );

      void refreshHealth(vehicleId);
    }

    function handleAlertResolved(
      alert: LiveAlertEvent,
    ): void {
      handleAlertUpdated(alert);
    }

    socket.connect();

    socket.emit(
      "vehicle:join",
      vehicleId,
    );

    socket.on(
      "telemetry:updated",
      handleTelemetryUpdate,
    );

    socket.on(
      "alert:created",
      handleAlertCreated,
    );

    socket.on(
      "alert:updated",
      handleAlertUpdated,
    );

    socket.on(
      "alert:resolved",
      handleAlertResolved,
    );

    return () => {
      socket.emit(
        "vehicle:leave",
        vehicleId,
      );

      socket.off(
        "telemetry:updated",
        handleTelemetryUpdate,
      );

      socket.off(
        "alert:created",
        handleAlertCreated,
      );

      socket.off(
        "alert:updated",
        handleAlertUpdated,
      );

      socket.off(
        "alert:resolved",
        handleAlertResolved,
      );

      socket.disconnect();
    };
  }, [vehicleId, latest?.vehicle.vehicleCode]);

  const chartData = useMemo(() => {
    return [...history]
      .reverse()
      .map((reading) => ({
        time: formatChartTime(reading.recordedAt),
        speedKmh: reading.speedKmh,
        temperatureC: reading.temperatureC,
      }));
  }, [history]);

  const activeAlertCount = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "ACTIVE" ||
          alert.status === "ACKNOWLEDGED",
      ).length,
    [alerts],
  );

  if (isLoading) {
    return (
      <div className="details-page">
        <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>

        <div className="details-state">
          Loading vehicle telemetry...
        </div>
      </div>
    );
  }

  if (errorMessage || !latest) {
    return (
      <div className="details-page">
        <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>

        <div className="details-state details-error">
          {errorMessage ??
            "Vehicle data could not be loaded."}
        </div>
      </div>
    );
  }

  const telemetry = latest.telemetry;

  const displayedStatus =
    activeAlertCount > 0
      ? "WARNING"
      : latest.vehicle.status;

  return (
    <div className="details-page">
      <Link className="back-link" to="/">
        {"\u2190"} Fleet overview
      </Link>

      <header className="details-header">
        <div>
          <p className="eyebrow">
            Vehicle intelligence
          </p>

          <h1>
            {latest.vehicle.vehicleCode}
          </h1>

          <p className="page-description">
            {latest.vehicle.manufacturer}{" "}
            {latest.vehicle.model}
          </p>
        </div>

        <div className="details-status-group">
          <span className="live-indicator">
            <span className="live-indicator-dot" />
            Live telemetry
          </span>

          <span
            className={`status-badge status-${displayedStatus.toLowerCase()}`}
          >
            <span className="status-dot" />
            {displayedStatus}
          </span>
        </div>
      </header>

      {!telemetry ? (
        <div className="details-state">
          No telemetry has been received for this vehicle.
        </div>
      ) : (
        <>
          <section className="telemetry-grid">
            <article className="telemetry-card">
              <span>Speed</span>
              <strong>
                {formatNumber(
                  telemetry.speedKmh,
                )}{" "}
                <small>km/h</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Engine speed</span>
              <strong>
                {telemetry.rpm}{" "}
                <small>RPM</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Temperature</span>
              <strong>
                {formatNumber(
                  telemetry.temperatureC,
                )}{" "}
                <small>{"\u00B0C"}</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Battery</span>
              <strong>
                {formatNumber(
                  telemetry.batteryPercentage,
                  2,
                )}{" "}
                <small>%</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Battery voltage</span>
              <strong>
                {formatNumber(
                  telemetry.batteryVoltage,
                  2,
                )}{" "}
                <small>V</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Current draw</span>
              <strong>
                {formatNumber(
                  telemetry.currentAmps,
                  2,
                )}{" "}
                <small>A</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Vibration</span>
              <strong>
                {formatNumber(
                  telemetry.vibration,
                  3,
                )}
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Latest reading</span>
              <strong className="timestamp-value">
                {formatTimestamp(
                  telemetry.recordedAt,
                )}
              </strong>
            </article>
          </section>

          {health && (
            <section className="health-panel">
              <div className="health-summary">
                <div>
                  <p className="health-label">
                    Vehicle health
                  </p>

                  <div className="health-score-row">
                    <strong className="health-score">
                      {health.score}
                    </strong>

                    <span className="health-out-of">
                      / 100
                    </span>
                  </div>

                  <span
                    className={`health-condition health-${health.condition.toLowerCase()}`}
                  >
                    {health.condition}
                  </span>
                </div>

                <div className="health-meter-area">
                  <div className="health-meter-header">
                    <span>Overall condition</span>
                    <strong>{health.score}%</strong>
                  </div>

                  <div className="health-meter">
                    <div
                      className="health-meter-fill"
                      style={{
                        width: `${health.score}%`,
                      }}
                    />
                  </div>

                  <span className="health-calculated">
                    Calculated{" "}
                    {formatTimestamp(
                      health.calculatedAt,
                    )}
                  </span>
                </div>
              </div>

              <div className="health-factor-grid">
                <article>
                  <span>Temperature</span>
                  <strong>
                    {formatPenalty(health.factors.temperaturePenalty)}
                  </strong>
                </article>

                <article>
                  <span>Vibration</span>
                  <strong>
                    {formatPenalty(health.factors.vibrationPenalty)}
                  </strong>
                </article>

                <article>
                  <span>Battery voltage</span>
                  <strong>
                    {formatPenalty(health.factors.batteryVoltagePenalty)}
                  </strong>
                </article>

                <article>
                  <span>Battery charge</span>
                  <strong>
                    {formatPenalty(health.factors.batteryPercentagePenalty)}
                  </strong>
                </article>

                <article>
                  <span>Active alerts</span>
                  <strong>
                    {formatPenalty(health.factors.alertPenalty)}
                  </strong>
                </article>

                <article>
                  <span>Telemetry age</span>
                  <strong>
                    {formatPenalty(health.factors.telemetryFreshnessPenalty)}
                  </strong>
                </article>

                <article>
                  <span>Trend risk</span>
                  <strong>
                    {formatPenalty(health.factors.trendPenalty)}
                  </strong>
                </article>
              </div>

              <div className="health-trends">
                <div className="health-trends-header">
                  <div>
                    <p className="health-label">
                      Recent telemetry trends
                    </p>

                    <span>
                      Based on {health.trends.sampleCount} recent
                      readings over{" "}
                      {formatNumber(
                        health.trends.windowMinutes,
                        2,
                      )}{" "}
                      minutes
                    </span>
                  </div>

                  <strong>
                    Trend penalty: {formatPenalty(health.factors.trendPenalty)}
                  </strong>
                </div>

                <div className="health-trend-grid">
                  <article>
                    <span>Temperature trend</span>

                    <strong>
                      {health.trends.temperatureChangeC > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.temperatureChangeC,
                        2,
                      )}{" "}
                      {"\u00B0C"}
                    </strong>

                    <small>
                      {health.trends.temperatureRatePerMinute > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.temperatureRatePerMinute,
                        2,
                      )}{" "}
                      {"\u00B0C"}/min
                    </small>
                  </article>

                  <article>
                    <span>Vibration trend</span>

                    <strong>
                      {health.trends.vibrationChange > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.vibrationChange,
                        3,
                      )}
                    </strong>

                    <small>
                      {health.trends.vibrationRatePerMinute > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.vibrationRatePerMinute,
                        3,
                      )}{" "}
                      /min
                    </small>
                  </article>

                  <article>
                    <span>Battery voltage trend</span>

                    <strong>
                      {health.trends.batteryVoltageChange > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.batteryVoltageChange,
                        2,
                      )}{" "}
                      V
                    </strong>

                    <small>
                      {health.trends.batteryVoltageRatePerMinute > 0
                        ? "+"
                        : ""}
                      {formatNumber(
                        health.trends.batteryVoltageRatePerMinute,
                        3,
                      )}{" "}
                      V/min
                    </small>
                  </article>
                </div>
              </div>
            </section>
          )}

          <section className="vehicle-alert-history">
            <div className="vehicle-alert-history-header">
              <div>
                <h2>Alert history</h2>
                <p>
                  Faults and warnings recorded for this
                  vehicle.
                </p>
              </div>

              <span className="alerts-count">
                {alerts.length}
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="vehicle-alert-empty">
                <strong>
                  No alert history
                </strong>

                <span>
                  No faults have been recorded for this
                  vehicle.
                </span>
              </div>
            ) : (
              <div className="vehicle-alert-list">
                {alerts.map((alert) => (
                  <article
                    className={`vehicle-alert-row alert-${alert.severity.toLowerCase()}`}
                    key={alert.id}
                  >
                    <div className="vehicle-alert-main">
                      <div className="alert-heading">
                        <span
                          className={`alert-severity severity-${alert.severity.toLowerCase()}`}
                        >
                          {formatAlertValue(
                            alert.severity,
                          )}
                        </span>

                        <span className="alert-status">
                          {formatAlertValue(
                            alert.status,
                          )}
                        </span>
                      </div>

                      <h3>
                        {formatAlertValue(
                          alert.type,
                        )}
                      </h3>

                      <p>{alert.message}</p>

                      <div className="vehicle-alert-times">
                        <span>
                          Triggered:{" "}
                          {formatTimestamp(
                            alert.triggeredAt,
                          )}
                        </span>

                        {alert.acknowledgedAt && (
                          <span>
                            Acknowledged:{" "}
                            {formatTimestamp(
                              alert.acknowledgedAt,
                            )}
                          </span>
                        )}

                        {alert.resolvedAt && (
                          <span>
                            Resolved:{" "}
                            {formatTimestamp(
                              alert.resolvedAt,
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {alert.status === "ACTIVE" && (
                      <button
                        className="acknowledge-button"
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
                          ? "Acknowledging..."
                          : "Acknowledge"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="chart-grid">
            <article className="chart-panel">
              <div className="chart-heading">
                <h2>Speed history</h2>
                <p>
                  Most recent {history.length} readings
                </p>
              </div>

              <div className="chart-container">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#233044"
                    />

                    <XAxis
                      dataKey="time"
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      unit=" km/h"
                    />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="speedKmh"
                      stroke="#4f8cff"
                      strokeWidth={2}
                      dot={false}
                      name="Speed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="chart-panel">
              <div className="chart-heading">
                <h2>
                  Temperature history
                </h2>

                <p>
                  Thermal trend over recent readings
                </p>
              </div>

              <div className="chart-container">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#233044"
                    />

                    <XAxis
                      dataKey="time"
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      unit={"\u00B0C"}
                    />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="temperatureC"
                      stroke="#f0a94b"
                      strokeWidth={2}
                      dot={false}
                      name="Temperature"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="location-panel">
            <h2>Latest position</h2>

            <div>
              <span>Latitude</span>
              <strong>
                {formatNumber(
                  telemetry.latitude,
                  6,
                )}
              </strong>
            </div>

            <div>
              <span>Longitude</span>
              <strong>
                {formatNumber(
                  telemetry.longitude,
                  6,
                )}
              </strong>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
