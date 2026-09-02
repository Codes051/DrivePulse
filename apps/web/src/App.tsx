import { Route, Routes } from "react-router";

import "./App.css";
import { AlertsPage } from "./pages/AlertsPage";
import { FleetOverviewPage } from "./pages/FleetOverviewPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { VehicleDetailsPage } from "./pages/VehicleDetailsPage";

function App() {
  return (
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
  );
}

export default App;
