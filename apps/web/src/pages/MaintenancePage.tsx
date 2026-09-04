import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { socket } from "../socket";

interface MaintenanceRecommendation {
  id: string;
  vehicleId: string;
  type:
    | "COOLING_SYSTEM"
    | "BATTERY_SYSTEM"
    | "VIBRATION_INSPECTION"
    | "TELEMETRY_SYSTEM"
    | "GENERAL_INSPECTION";
  priority:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "DISMISSED";
  title: string;
  description: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  vehicle: {
    id: string;
    vehicleCode: string;
    manufacturer: string;
    model: string;
  };
}

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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MaintenancePage() {
  const [recommendations, setRecommendations] =
    useState<MaintenanceRecommendation[]>([]);

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [isLoading, setIsLoading] =
    useState(true);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function loadMaintenance(): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/maintenance`,
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load maintenance recommendations.",
        );
      }

      const data =
        (await response.json()) as MaintenanceRecommendation[];

      setRecommendations(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load maintenance recommendations.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    status: MaintenanceRecommendation["status"],
  ): Promise<void> {
    try {
      setUpdatingId(id);
      setErrorMessage(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/maintenance/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Unable to update maintenance recommendation.",
        );
      }

      const updated =
        (await response.json()) as MaintenanceRecommendation;

      setRecommendations((current) =>
        current.map((recommendation) =>
          recommendation.id === id
            ? {
                ...recommendation,
                ...updated,
                vehicle: recommendation.vehicle,
              }
            : recommendation,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update maintenance recommendation.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    void loadMaintenance();

    function handleMaintenanceChange(): void {
      void loadMaintenance();
    }

    socket.connect();
    socket.emit("fleet:join");

    socket.on(
      "maintenance:created",
      handleMaintenanceChange,
    );

    socket.on(
      "maintenance:updated",
      handleMaintenanceChange,
    );

    return () => {
      socket.emit("fleet:leave");

      socket.off(
        "maintenance:created",
        handleMaintenanceChange,
      );

      socket.off(
        "maintenance:updated",
        handleMaintenanceChange,
      );

      socket.disconnect();
    };
  }, []);

  const filteredRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) =>
          statusFilter === "ALL" ||
          recommendation.status === statusFilter,
      ),
    [recommendations, statusFilter],
  );

  const openCount = recommendations.filter(
    (item) => item.status === "OPEN",
  ).length;

  const inProgressCount = recommendations.filter(
    (item) => item.status === "IN_PROGRESS",
  ).length;

  const completedCount = recommendations.filter(
    (item) => item.status === "COMPLETED",
  ).length;

  const criticalCount = recommendations.filter(
    (item) =>
      item.priority === "CRITICAL" &&
      item.status !== "COMPLETED" &&
      item.status !== "DISMISSED",
  ).length;

  return (
    <div className="maintenance-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Predictive maintenance
          </p>

          <h1>Maintenance</h1>

          <p className="page-description">
            Recommended maintenance actions generated from
            vehicle alerts and telemetry conditions.
          </p>
        </div>

        <Link className="back-link" to="/">
          {"\u2190"} Fleet overview
        </Link>
      </div>

      <section className="maintenance-stat-grid">
        <article className="stat-card">
          <span className="stat-label">Open</span>
          <strong>{openCount}</strong>
          <span className="stat-note">
            Awaiting action
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            In progress
          </span>
          <strong>{inProgressCount}</strong>
          <span className="stat-note">
            Currently being handled
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Critical
          </span>
          <strong>{criticalCount}</strong>
          <span className="stat-note">
            High-priority attention
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-label">
            Completed
          </span>
          <strong>{completedCount}</strong>
          <span className="stat-note">
            Resolved maintenance work
          </span>
        </article>
      </section>

      <section className="maintenance-filter-panel">
        <div>
          <label htmlFor="maintenance-status">
            Status
          </label>

          <select
            id="maintenance-status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">
              In progress
            </option>
            <option value="COMPLETED">
              Completed
            </option>
            <option value="DISMISSED">
              Dismissed
            </option>
          </select>
        </div>
      </section>

      {errorMessage && (
        <div className="error-message">
          <strong>{errorMessage}</strong>
        </div>
      )}

      {isLoading ? (
        <div className="details-state">
          Loading maintenance recommendations...
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="details-state">
          No maintenance recommendations found.
        </div>
      ) : (
        <section className="maintenance-list">
          {filteredRecommendations.map(
            (recommendation) => (
              <article
                className={`maintenance-card priority-${recommendation.priority.toLowerCase()}`}
                key={recommendation.id}
              >
                <div className="maintenance-card-main">
                  <div className="maintenance-heading">
                    <span
                      className={`maintenance-priority priority-badge-${recommendation.priority.toLowerCase()}`}
                    >
                      {formatValue(
                        recommendation.priority,
                      )}
                    </span>

                    <span className="maintenance-status">
                      {formatValue(
                        recommendation.status,
                      )}
                    </span>
                  </div>

                  <h2>{recommendation.title}</h2>

                  <p>
                    {recommendation.description}
                  </p>

                  <div className="maintenance-reason">
                    <strong>Reason</strong>
                    <span>
                      {recommendation.reason}
                    </span>
                  </div>

                  <div className="maintenance-meta">
                    <Link
                      to={`/vehicles/${recommendation.vehicle.id}`}
                    >
                      {
                        recommendation.vehicle
                          .vehicleCode
                      }
                    </Link>

                    <span>
                      {
                        recommendation.vehicle
                          .manufacturer
                      }{" "}
                      {recommendation.vehicle.model}
                    </span>

                    <span>
                      Created{" "}
                      {formatTimestamp(
                        recommendation.createdAt,
                      )}
                    </span>
                  </div>
                </div>

                <div className="maintenance-actions">
                  {recommendation.status === "OPEN" && (
                    <button
                      type="button"
                      disabled={
                        updatingId ===
                        recommendation.id
                      }
                      onClick={() =>
                        void updateStatus(
                          recommendation.id,
                          "IN_PROGRESS",
                        )
                      }
                    >
                      Start work
                    </button>
                  )}

                  {(recommendation.status === "OPEN" ||
                    recommendation.status ===
                      "IN_PROGRESS") && (
                    <button
                      type="button"
                      disabled={
                        updatingId ===
                        recommendation.id
                      }
                      onClick={() =>
                        void updateStatus(
                          recommendation.id,
                          "COMPLETED",
                        )
                      }
                    >
                      Complete
                    </button>
                  )}

                  {(recommendation.status === "OPEN" ||
                    recommendation.status ===
                      "IN_PROGRESS") && (
                    <button
                      className="maintenance-dismiss"
                      type="button"
                      disabled={
                        updatingId ===
                        recommendation.id
                      }
                      onClick={() =>
                        void updateStatus(
                          recommendation.id,
                          "DISMISSED",
                        )
                      }
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </article>
            ),
          )}
        </section>
      )}
    </div>
  );
}
