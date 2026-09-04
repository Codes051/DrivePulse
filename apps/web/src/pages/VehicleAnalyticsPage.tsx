import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router";

import { fetchVehicles } from "../api";
import type {
  Vehicle,
  VehicleStatus,
} from "../types";

import "../App.css";

function formatStatus(
  status: VehicleStatus,
): string {
  return (
    status.charAt(0) +
    status.slice(1).toLowerCase()
  );
}

function getStatusClass(
  status: VehicleStatus,
): string {
  return `status-badge status-${status.toLowerCase()}`;
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function VehicleAnalyticsPage() {
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function loadVehicles(
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const result =
        await fetchVehicles(signal);

      if (signal?.aborted) {
        return;
      }

      setVehicles(result.vehicles);
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
          : "Unable to load vehicle analytics.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller =
      new AbortController();

    void loadVehicles(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, []);

  const statistics = useMemo(
    () => ({
      total: vehicles.length,

      online: vehicles.filter(
        (vehicle) =>
          vehicle.status === "ONLINE",
      ).length,

      warning: vehicles.filter(
        (vehicle) =>
          vehicle.status === "WARNING",
      ).length,

      offline: vehicles.filter(
        (vehicle) =>
          vehicle.status === "OFFLINE",
      ).length,
    }),
    [vehicles],
  );

  return (
    <div className="vehicle-analytics-oem">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              Fleet / Analytics
            </p>

            <h1>Vehicle analytics</h1>

            <p className="page-description">
              Select a vehicle to inspect live telemetry,
              historical sensor data, alerts, health scoring
              and recent operating trends.
            </p>
          </div>

          <button
            className="refresh-button"
            type="button"
            onClick={() =>
              void loadVehicles()
            }
            disabled={isLoading}
          >
            {isLoading
              ? "Refreshing..."
              : "Refresh data"}
          </button>
        </header>

        <section
          className="stat-grid"
          aria-label="Vehicle analytics statistics"
        >
          <article className="stat-card">
            <span className="stat-label">
              Vehicles
            </span>

            <strong>
              {statistics.total}
            </strong>

            <span className="stat-note">
              Available for analysis
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">
              Online
            </span>

            <strong>
              {statistics.online}
            </strong>

            <span className="stat-note">
              Reporting normally
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">
              Warnings
            </span>

            <strong>
              {statistics.warning}
            </strong>

            <span className="stat-note">
              Require attention
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">
              Offline
            </span>

            <strong>
              {statistics.offline}
            </strong>

            <span className="stat-note">
              Telemetry unavailable
            </span>
          </article>
        </section>

        {errorMessage && (
          <div
            className="error-message"
            role="alert"
          >
            <div>
              <strong>
                Analytics request failed
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadVehicles()
              }
            >
              Try again
            </button>
          </div>
        )}

        <section className="fleet-panel analytics-panel">
          <div className="panel-header">
            <div>
              <h2>
                Vehicle analytics
              </h2>

              <p>
                Open a vehicle to view its
                detailed telemetry and health
                analysis.
              </p>
            </div>
          </div>

          {isLoading &&
            vehicles.length === 0 && (
              <div className="empty-state">
                <div className="loading-spinner" />

                <p>
                  Loading vehicles...
                </p>
              </div>
            )}

          {!isLoading &&
            !errorMessage &&
            vehicles.length === 0 && (
              <div className="empty-state">
                <h3>
                  No vehicles available
                </h3>

                <p>
                  Register a vehicle before
                  opening vehicle analytics.
                </p>
              </div>
            )}

          {vehicles.length > 0 && (
            <div className="analytics-grid">
              {vehicles.map(
                (vehicle) => (
                  <article
                    className="analytics-card"
                    key={vehicle.id}
                  >
                    <div className="analytics-card-heading">
                      <div className="vehicle-identity">
                        <span className="vehicle-icon">
                          V
                        </span>

                        <div>
                          <h3>
                            {
                              vehicle.vehicleCode
                            }
                          </h3>

                          <span>
                            {
                              vehicle.manufacturer
                            }{" "}
                            {vehicle.model}
                          </span>
                        </div>
                      </div>

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

                    <div className="analytics-card-details">
                      <div>
                        <span>
                          Manufacturer
                        </span>

                        <strong>
                          {
                            vehicle.manufacturer
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Model</span>

                        <strong>
                          {vehicle.model}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Model year
                        </span>

                        <strong>
                          {vehicle.year ?? "Ã¢â‚¬â€"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Last updated
                        </span>

                        <strong>
                          {formatDate(
                            vehicle.updatedAt,
                          )}
                        </strong>
                      </div>
                    </div>

                    <Link
                      className="analytics-open-button"
                      to={`/vehicles/${vehicle.id}`}
                    >
                      Open analytics
                    </Link>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </div>
  );
}
