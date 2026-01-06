import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ManufacturersPage from "./pages/ManufacturersPage";
import EquipmentCategoriesPage from "./pages/EquipmentCategoriesPage";
import LocationsPage from "./pages/LocationsPage";
import EquipmentTypesPage from "./pages/EquipmentTypesPage";
import WarehousesPage from "./pages/WarehousesPage";
import WarehouseItemsPage from "./pages/WarehouseItemsPage";
import CabinetsPage from "./pages/CabinetsPage";
import CabinetItemsPage from "./pages/CabinetItemsPage";
import MovementsPage from "./pages/MovementsPage";
import IOSignalsPage from "./pages/IOSignalsPage";
import UsersPage from "./pages/UsersPage";
import SessionsPage from "./pages/SessionsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import DclPage from "./pages/DclPage";
import CabinetCompositionPage from "./pages/CabinetCompositionPage";
import HelpPage from "./pages/HelpPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dictionaries" element={<Navigate to="/dictionaries/manufacturers" replace />} />
                <Route path="/dictionaries/manufacturers" element={<ManufacturersPage />} />
                <Route path="/dictionaries/locations" element={<LocationsPage />} />
                <Route path="/dictionaries/equipment-categories" element={<EquipmentCategoriesPage />} />
                <Route path="/dictionaries/equipment-types" element={<EquipmentTypesPage />} />
                <Route path="/warehouses" element={<WarehousesPage />} />
                <Route path="/warehouse-items" element={<WarehouseItemsPage />} />
                <Route path="/cabinets" element={<CabinetsPage />} />
                <Route path="/cabinet-items" element={<CabinetItemsPage />} />
                <Route path="/cabinets/:id/composition" element={<CabinetCompositionPage />} />
                <Route path="/movements" element={<MovementsPage />} />
                <Route path="/io-signals" element={<IOSignalsPage />} />
                <Route path="/engineering/dcl" element={<DclPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/sessions" element={<SessionsPage />} />
                <Route path="/admin/audit" element={<AuditLogsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
