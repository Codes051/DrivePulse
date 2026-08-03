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
import { socket } from "../socket";
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

export function VehicleDetailsPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();

  const [latest, setLatest] =
    useState<LatestTelemetryResponse | null>(null);
  const [history, setHistory] =
    useState<TelemetryReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

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

        const [latestResult, historyResult] =
          await Promise.all([
            fetchLatestTelemetry(
              vehicleId!,
              controller.signal,
            ),
            fetchTelemetryHistory(
              vehicleId!,
              60,
              controller.signal,
            ),
          ]);

        setLatest(latestResult);
        setHistory(historyResult.telemetry);
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
          vehicle: {
            ...current.vehicle,
            status: "ONLINE",
          },
          telemetry: reading,
        };
      });

      setHistory((current) => {
        const withoutDuplicate = current.filter(
          (existingReading) =>
            existingReading.id !== reading.id,
        );

        return [reading, ...withoutDuplicate].slice(0, 60);
      });
    }

    socket.connect();
    socket.emit("vehicle:join", vehicleId);
    socket.on("telemetry:updated", handleTelemetryUpdate);

    return () => {
      socket.emit("vehicle:leave", vehicleId);
      socket.off(
        "telemetry:updated",
        handleTelemetryUpdate,
      );
      socket.disconnect();
    };
  }, [vehicleId]);
  const chartData = useMemo(() => {
    return [...history]
      .reverse()
      .map((reading) => ({
        time: formatChartTime(reading.recordedAt),
        speedKmh: reading.speedKmh,
        temperatureC: reading.temperatureC,
      }));
  }, [history]);

  if (isLoading) {
    return (
      <main className="details-page">
        <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>

        <div className="details-state">
          Loading vehicle telemetry...
        </div>
      </main>
    );
  }

  if (errorMessage || !latest) {
    return (
      <main className="details-page">
        <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>

        <div className="details-state details-error">
          {errorMessage ?? "Vehicle data could not be loaded."}
        </div>
      </main>
    );
  }

  const telemetry = latest.telemetry;

  return (
    <main className="details-page">
      <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>

      <header className="details-header">
        <div>
          <p className="eyebrow">Vehicle intelligence</p>
          <h1>{latest.vehicle.vehicleCode}</h1>
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
            className={`status-badge status-${latest.vehicle.status.toLowerCase()}`}
          >
            <span className="status-dot" />
            {latest.vehicle.status}
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
                {formatNumber(telemetry.speedKmh)}{" "}
                <small>km/h</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Engine speed</span>
              <strong>
                {telemetry.rpm} <small>RPM</small>
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Temperature</span>
              <strong>
                {formatNumber(telemetry.temperatureC)}{" "}
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
                {formatNumber(telemetry.vibration, 3)}
              </strong>
            </article>

            <article className="telemetry-card">
              <span>Latest reading</span>
              <strong className="timestamp-value">
                {formatTimestamp(telemetry.recordedAt)}
              </strong>
            </article>
          </section>

          <section className="chart-grid">
            <article className="chart-panel">
              <div className="chart-heading">
                <h2>Speed history</h2>
                <p>Most recent {history.length} readings</p>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
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
                <h2>Temperature history</h2>
                <p>Thermal trend over recent readings</p>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
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
                {formatNumber(telemetry.latitude, 6)}
              </strong>
            </div>

            <div>
              <span>Longitude</span>
              <strong>
                {formatNumber(telemetry.longitude, 6)}
              </strong>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
