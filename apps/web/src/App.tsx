import { Route, Routes } from "react-router";

import "./App.css";
import { FleetOverviewPage } from "./pages/FleetOverviewPage";
import { VehicleDetailsPage } from "./pages/VehicleDetailsPage";

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
    </Routes>
  );
}

export default App;
