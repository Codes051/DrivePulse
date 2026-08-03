import { useEffect, useMemo, useState } from "react";

import { fetchVehicles } from "./api";
import type { Vehicle, VehicleStatus } from "./types";

import "./App.css";

function formatStatus(status: VehicleStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
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

function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadVehicles(signal?: AbortSignal): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await fetchVehicles(signal);
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
          : "An unexpected error occurred.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void loadVehicles(controller.signal);

    return () => {
      controller.abort();
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
            <div className="brand-subtitle">Fleet Intelligence</div>
          </div>
        </div>

        <nav className="navigation" aria-label="Main navigation">
          <button className="nav-item nav-item-active" type="button">
            Fleet Overview
          </button>

          <button className="nav-item" type="button" disabled>
            Vehicle Analytics
          </button>

          <button className="nav-item" type="button" disabled>
            Alerts
          </button>

          <button className="nav-item" type="button" disabled>
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
            <p className="eyebrow">Connected vehicle platform</p>
            <h1>Fleet overview</h1>
            <p className="page-description">
              Monitor vehicle connectivity, operational status and
              incoming telemetry.
            </p>
          </div>

          <button
            className="refresh-button"
            type="button"
            onClick={() => void loadVehicles()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh data"}
          </button>
        </header>

        <section className="stat-grid" aria-label="Fleet statistics">
          <article className="stat-card">
            <span className="stat-label">Total vehicles</span>
            <strong>{statistics.total}</strong>
            <span className="stat-note">Registered in DrivePulse</span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Online</span>
            <strong>{statistics.online}</strong>
            <span className="stat-note">Sending telemetry</span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Warnings</span>
            <strong>{statistics.warning}</strong>
            <span className="stat-note">Require attention</span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Offline</span>
            <strong>{statistics.offline}</strong>
            <span className="stat-note">Not currently connected</span>
          </article>
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

          {errorMessage && (
            <div className="error-message" role="alert">
              <div>
                <strong>Unable to load fleet data</strong>
                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                onClick={() => void loadVehicles()}
              >
                Try again
              </button>
            </div>
          )}

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
                  Create a vehicle through the API to make it appear
                  here.
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
                            <strong>{vehicle.vehicleCode}</strong>
                            <span>{vehicle.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td>{vehicle.manufacturer}</td>
                      <td>{vehicle.model}</td>
                      <td>{vehicle.year ?? "—"}</td>

                      <td>
                        <span className={getStatusClass(vehicle.status)}>
                          <span className="status-dot" />
                          {formatStatus(vehicle.status)}
                        </span>
                      </td>

                      <td>{formatDate(vehicle.updatedAt)}</td>
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

export default App;
