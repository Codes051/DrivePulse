import {
  lazy,
  Suspense,
} from "react";
import { Route, Routes } from "react-router";

import "./App.css";

const FleetOverviewPage = lazy(async () => {
  const module = await import(
    "./pages/FleetOverviewPage"
  );

  return {
    default: module.FleetOverviewPage,
  };
});

const VehicleDetailsPage = lazy(async () => {
  const module = await import(
    "./pages/VehicleDetailsPage"
  );

  return {
    default: module.VehicleDetailsPage,
  };
});

const AlertsPage = lazy(async () => {
  const module = await import(
    "./pages/AlertsPage"
  );

  return {
    default: module.AlertsPage,
  };
});

const MaintenancePage = lazy(async () => {
  const module = await import(
    "./pages/MaintenancePage"
  );

  return {
    default: module.MaintenancePage,
  };
});

function RouteLoadingState() {
  return (
    <main className="details-page">
      <div className="details-state">
        Loading DrivePulse...
      </div>
    </main>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>
        <Route
          path="/"
          element={<FleetOverviewPage />}
        />

        <Route
          path="/vehicles/:vehicleId"
          element={<VehicleDetailsPage />}
        />

        <Route
          path="/alerts"
          element={<AlertsPage />}
        />

        <Route
          path="/maintenance"
          element={<MaintenancePage />}
        />

        <Route
          path="*"
          element={
            <main className="details-page">
              <h1>Page not found</h1>
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;