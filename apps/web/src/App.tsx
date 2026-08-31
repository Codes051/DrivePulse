import { Route, Routes } from "react-router";

import "./App.css";
import { FleetOverviewPage } from "./pages/FleetOverviewPage";
import { VehicleDetailsPage } from "./pages/VehicleDetailsPage";
import { AlertsPage } from "./pages/AlertsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<FleetOverviewPage />} />
      <Route
        path="/vehicles/:vehicleId"
        element={<VehicleDetailsPage />}
      />
      <Route
        path="*"
        element={
          <main className="details-page">
            <h1>Page not found</h1>
          </main>
        }
      />
          <Route
        path="/alerts"
        element={<AlertsPage />}
      />
</Routes>
  );
}

export default App;
