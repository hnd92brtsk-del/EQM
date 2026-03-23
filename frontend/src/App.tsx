import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ManufacturersPage = lazy(() => import("./pages/ManufacturersPage"));
const EquipmentCategoriesPage = lazy(() => import("./pages/EquipmentCategoriesPage"));
const MainEquipmentPage = lazy(() => import("./pages/MainEquipmentPage"));
const DataTypesPage = lazy(() => import("./pages/DataTypesPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const FieldEquipmentsPage = lazy(() => import("./pages/FieldEquipmentsPage"));
const MeasurementUnitsPage = lazy(() => import("./pages/MeasurementUnitsPage"));
const SignalTypesPage = lazy(() => import("./pages/SignalTypesPage"));
const EquipmentTypesPage = lazy(() => import("./pages/EquipmentTypesPage"));
const WarehousesPage = lazy(() => import("./pages/WarehousesPage"));
const WarehouseItemsPage = lazy(() => import("./pages/WarehouseItemsPage"));
const CabinetsPage = lazy(() => import("./pages/CabinetsPage"));
const AssembliesPage = lazy(() => import("./pages/AssembliesPage"));
const CabinetItemsPage = lazy(() => import("./pages/CabinetItemsPage"));
const MovementsPage = lazy(() => import("./pages/MovementsPage"));
const IOSignalsPage = lazy(() => import("./pages/IOSignalsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SessionsPage = lazy(() => import("./pages/SessionsPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const AdminDiagnosticsPage = lazy(() => import("./pages/AdminDiagnosticsPage"));
const DclPage = lazy(() => import("./pages/DclPage"));
const SerialMapPage = lazy(() => import("./pages/SerialMapPage"));
const NetworkMapPage = lazy(() => import("./pages/NetworkMapPage"));
const CabinetCompositionPage = lazy(() => import("./pages/CabinetCompositionPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PersonnelPage = lazy(() => import("./pages/PersonnelPage"));
const PersonnelSchedulePage = lazy(() => import("./pages/PersonnelSchedulePage"));
const PersonnelDetailsPage = lazy(() => import("./pages/PersonnelDetailsPage"));
const TechnologicalEquipmentPage = lazy(() => import("./pages/TechnologicalEquipmentPage"));
const IPAMPage = lazy(() => import("./features/ipam/pages/IPAMPage"));

function RouteLoadingFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 280, p: 4 }}>
      <CircularProgress />
    </Box>
  );
}

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
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dictionaries" element={<Navigate to="/dictionaries/manufacturers" replace />} />
                  <Route path="/dictionaries/manufacturers" element={<ManufacturersPage />} />
                  <Route path="/dictionaries/locations" element={<LocationsPage />} />
                  <Route path="/dictionaries/field-equipments" element={<FieldEquipmentsPage />} />
                  <Route path="/dictionaries/main-equipment" element={<MainEquipmentPage />} />
                  <Route path="/dictionaries/data-types" element={<DataTypesPage />} />
                  <Route path="/dictionaries/measurement-units" element={<MeasurementUnitsPage />} />
                  <Route path="/dictionaries/signal-types" element={<SignalTypesPage />} />
                  <Route path="/dictionaries/equipment-categories" element={<EquipmentCategoriesPage />} />
                  <Route path="/dictionaries/equipment-types" element={<EquipmentTypesPage />} />
                  <Route path="/warehouses" element={<WarehousesPage />} />
                  <Route path="/warehouse-items" element={<WarehouseItemsPage />} />
                  <Route path="/cabinets" element={<CabinetsPage />} />
                  <Route path="/assemblies" element={<AssembliesPage />} />
                  <Route path="/cabinet-items" element={<CabinetItemsPage />} />
                  <Route path="/equipment/technological" element={<TechnologicalEquipmentPage />} />
                  <Route path="/cabinets/:id/composition" element={<CabinetCompositionPage />} />
                  <Route path="/assemblies/:id/composition" element={<CabinetCompositionPage />} />
                  <Route path="/movements" element={<MovementsPage />} />
                  <Route path="/io-signals" element={<IOSignalsPage />} />
                  <Route path="/ipam" element={<IPAMPage />} />
                  <Route path="/engineering/dcl" element={<DclPage />} />
                  <Route path="/engineering/serial-map" element={<SerialMapPage />} />
                  <Route path="/engineering/network-map" element={<NetworkMapPage />} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/personnel" element={<PersonnelPage />} />
                  <Route path="/personnel/schedule" element={<PersonnelSchedulePage />} />
                  <Route path="/personnel/:id" element={<PersonnelDetailsPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/sessions" element={<SessionsPage />} />
                  <Route path="/admin/audit" element={<AuditLogsPage />} />
                  <Route path="/admin/diagnostics" element={<AdminDiagnosticsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
