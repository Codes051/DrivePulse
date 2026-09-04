import {
  lazy,
  Suspense,
} from "react";

import {
  Route,
  Routes,
} from "react-router";

import { AppShell } from "./components/AppShell";

import "./App.css";

const FleetOverviewPage = lazy(
  async () => {
    const module = await import(
      "./pages/FleetOverviewPage"
    );

    return {
      default:
        module.FleetOverviewPage,
    };
  },
);

const VehicleAnalyticsPage = lazy(
  async () => {
    const module = await import(
      "./pages/VehicleAnalyticsPage"
    );

    return {
      default:
        module.VehicleAnalyticsPage,
    };
  },
);

const VehicleDetailsPage = lazy(
  async () => {
    const module = await import(
      "./pages/VehicleDetailsPage"
    );

    return {
      default:
        module.VehicleDetailsPage,
    };
  },
);

const AlertsPage = lazy(
  async () => {
    const module = await import(
      "./pages/AlertsPage"
    );

    return {
      default:
        module.AlertsPage,
    };
  },
);

const MaintenancePage = lazy(
  async () => {
    const module = await import(
      "./pages/MaintenancePage"
    );

    return {
      default:
        module.MaintenancePage,
    };
  },
);

const SimulationLabPage = lazy(
  async () => {
    const module = await import(
      "./pages/SimulationLabPage"
    );

    return {
      default:
        module.SimulationLabPage,
    };
  },
);

function RouteLoadingState() {
  return (
    <div className="details-page">
      <div className="details-state">
        Loading DrivePulse...
      </div>
    </div>
  );
}

function App() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <RouteLoadingState />
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <FleetOverviewPage />
            }
          />

          <Route
            path="/analytics"
            element={
              <VehicleAnalyticsPage />
            }
          />

          <Route
            path="/vehicles/:vehicleId"
            element={
              <VehicleDetailsPage />
            }
          />

          <Route
            path="/alerts"
            element={
              <AlertsPage />
            }
          />

          <Route
            path="/maintenance"
            element={
              <MaintenancePage />
            }
          />

          <Route
            path="/simulation"
            element={
              <SimulationLabPage />
            }
          />

          <Route
            path="*"
            element={
              <div className="details-page">
                <h1>
                  Page not found
                </h1>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default App;