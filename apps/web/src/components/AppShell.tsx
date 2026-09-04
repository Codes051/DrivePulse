import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  NavLink,
  useLocation,
} from "react-router";

interface AppShellProps {
  children: ReactNode;
}

type SystemStatus =
  | "checking"
  | "operational"
  | "recovering"
  | "degraded";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

function linkClass(
  active: boolean,
): string {
  return active
    ? "sidebar-v2-link sidebar-v2-link-active"
    : "sidebar-v2-link";
}

function getSystemStatusLabel(
  status: SystemStatus,
): string {
  switch (status) {
    case "operational":
      return "Operational";

    case "recovering":
      return "Recovering";

    case "degraded":
      return "Degraded";

    default:
      return "Checking";
  }
}

export function AppShell({
  children,
}: AppShellProps) {
  const location = useLocation();

  const [systemStatus, setSystemStatus] =
    useState<SystemStatus>("checking");

  const consecutiveFailures = useRef(0);

  const analyticsActive =
    location.pathname === "/analytics" ||
    location.pathname.startsWith(
      "/vehicles/",
    );

  useEffect(() => {
    let disposed = false;

    async function checkSystemHealth(): Promise<void> {
      const controller = new AbortController();

      const timeoutId = window.setTimeout(
        () => controller.abort(),
        2500,
      );

      try {
        const [apiResponse, databaseResponse] =
          await Promise.all([
            fetch(
              `${API_BASE_URL}/health`,
              {
                signal: controller.signal,
                cache: "no-store",
              },
            ),
            fetch(
              `${API_BASE_URL}/health/database`,
              {
                signal: controller.signal,
                cache: "no-store",
              },
            ),
          ]);

        if (
          !apiResponse.ok ||
          !databaseResponse.ok
        ) {
          throw new Error(
            "DrivePulse health check failed.",
          );
        }

        consecutiveFailures.current = 0;

        if (!disposed) {
          setSystemStatus("operational");
        }
      } catch {
        consecutiveFailures.current += 1;

        if (!disposed) {
          setSystemStatus(
            consecutiveFailures.current >= 2
              ? "degraded"
              : "recovering",
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void checkSystemHealth();

    const intervalId = window.setInterval(
      () => {
        void checkSystemHealth();
      },
      5000,
    );

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar-v2">
        <div className="sidebar-v2-brand">
          <div className="sidebar-v2-mark">
            DP
          </div>

          <div>
            <strong>DrivePulse</strong>
            <span>Vehicle Intelligence</span>
          </div>
        </div>

        <div className="sidebar-v2-divider" />

        <nav
          className="sidebar-v2-nav"
          aria-label="Main navigation"
        >
          <span className="sidebar-v2-section">
            Drive
          </span>

          <NavLink
            end
            className={({ isActive }) =>
              linkClass(isActive)
            }
            to="/"
          >
            <span>01</span>
            Overview
          </NavLink>

          <NavLink
            className={linkClass(
              analyticsActive,
            )}
            to="/analytics"
          >
            <span>02</span>
            Analytics
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              linkClass(isActive)
            }
            to="/alerts"
          >
            <span>03</span>
            Alerts
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              linkClass(isActive)
            }
            to="/maintenance"
          >
            <span>04</span>
            Maintenance
          </NavLink>

          <span className="sidebar-v2-section sidebar-v2-tools">
            Tools
          </span>

          <NavLink
            className={({ isActive }) =>
              linkClass(isActive)
            }
            to="/simulation"
          >
            <span>05</span>
            Simulation
          </NavLink>
        </nav>

        <div className="sidebar-v2-footer">
          <div
            className="sidebar-v2-system"
            aria-live="polite"
          >
            <span
              className={
                `sidebar-v2-status-dot ` +
                `sidebar-v2-status-dot-${systemStatus}`
              }
            />

            <div>
              <small>System</small>

              <strong>
                {getSystemStatusLabel(
                  systemStatus,
                )}
              </strong>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}