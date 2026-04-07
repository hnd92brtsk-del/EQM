import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";

import { useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import { hasPermission, type PermissionAction, type SpaceKey } from "./utils/permissions";

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
const RolePermissionsPage = lazy(() => import("./pages/RolePermissionsPage"));
const DclPage = lazy(() => import("./pages/DclPage"));
const SerialMapPage = lazy(() => import("./pages/SerialMapPage"));
const SerialMapV2Page = lazy(() => import("./pages/SerialMapV2Page"));
const NetworkMapPage = lazy(() => import("./pages/NetworkMapPage"));
const CabinetCompositionPage = lazy(() => import("./pages/CabinetCompositionPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PersonnelPage = lazy(() => import("./pages/PersonnelPage"));
const PersonnelSchedulePage = lazy(() => import("./pages/PersonnelSchedulePage"));
const PersonnelDetailsPage = lazy(() => import("./pages/PersonnelDetailsPage"));
const TechnologicalEquipmentPage = lazy(() => import("./pages/TechnologicalEquipmentPage"));
const IPAMPage = lazy(() => import("./features/ipam/pages/IPAMPage"));
const MntIncidentsPage = lazy(() => import("./pages/maintenance/MntIncidentsPage"));
const MntWorkOrdersPage = lazy(() => import("./pages/maintenance/MntWorkOrdersPage"));
const MntPlansPage = lazy(() => import("./pages/maintenance/MntPlansPage"));
const MntOperatingTimePage = lazy(() => import("./pages/maintenance/MntOperatingTimePage"));
const MntReliabilityPage = lazy(() => import("./pages/maintenance/MntReliabilityPage"));

function RouteLoadingFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 280, p: 4 }}>
      <CircularProgress />
    </Box>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, authFailureReason } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          reason: authFailureReason
        }}
      />
    );
  }

  return children;
}

function RequireSpace({
  children,
  space,
  action = "read"
}: {
  children: JSX.Element;
  space: SpaceKey;
  action?: PermissionAction;
}) {
  const { user } = useAuth();
  if (!hasPermission(user, space, action)) {
    return <Typography>Нет доступа</Typography>;
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
                  <Route path="/dashboard" element={<RequireSpace space="overview"><DashboardPage /></RequireSpace>} />
                  <Route path="/dictionaries" element={<Navigate to="/dictionaries/manufacturers" replace />} />
                  <Route path="/dictionaries/manufacturers" element={<RequireSpace space="dictionaries"><ManufacturersPage /></RequireSpace>} />
                  <Route path="/dictionaries/locations" element={<RequireSpace space="dictionaries"><LocationsPage /></RequireSpace>} />
                  <Route path="/dictionaries/field-equipments" element={<RequireSpace space="dictionaries"><FieldEquipmentsPage /></RequireSpace>} />
                  <Route path="/dictionaries/main-equipment" element={<RequireSpace space="dictionaries"><MainEquipmentPage /></RequireSpace>} />
                  <Route path="/dictionaries/data-types" element={<RequireSpace space="dictionaries"><DataTypesPage /></RequireSpace>} />
                  <Route path="/dictionaries/measurement-units" element={<RequireSpace space="dictionaries"><MeasurementUnitsPage /></RequireSpace>} />
                  <Route path="/dictionaries/signal-types" element={<RequireSpace space="dictionaries"><SignalTypesPage /></RequireSpace>} />
                  <Route path="/dictionaries/equipment-categories" element={<RequireSpace space="dictionaries"><EquipmentCategoriesPage /></RequireSpace>} />
                  <Route path="/dictionaries/equipment-types" element={<RequireSpace space="equipment"><EquipmentTypesPage /></RequireSpace>} />
                  <Route path="/warehouses" element={<RequireSpace space="dictionaries"><WarehousesPage /></RequireSpace>} />
                  <Route path="/warehouse-items" element={<RequireSpace space="equipment"><WarehouseItemsPage /></RequireSpace>} />
                  <Route path="/cabinets" element={<RequireSpace space="cabinets"><CabinetsPage /></RequireSpace>} />
                  <Route path="/assemblies" element={<RequireSpace space="cabinets"><AssembliesPage /></RequireSpace>} />
                  <Route path="/cabinet-items" element={<RequireSpace space="equipment"><CabinetItemsPage /></RequireSpace>} />
                  <Route path="/equipment/technological" element={<RequireSpace space="equipment"><TechnologicalEquipmentPage /></RequireSpace>} />
                  <Route path="/cabinets/:id/composition" element={<RequireSpace space="cabinets"><CabinetCompositionPage /></RequireSpace>} />
                  <Route path="/assemblies/:id/composition" element={<RequireSpace space="cabinets"><CabinetCompositionPage /></RequireSpace>} />
                  <Route path="/movements" element={<RequireSpace space="equipment"><MovementsPage /></RequireSpace>} />
                  <Route path="/io-signals" element={<RequireSpace space="engineering"><IOSignalsPage /></RequireSpace>} />
                  <Route path="/ipam" element={<RequireSpace space="engineering"><IPAMPage /></RequireSpace>} />
                  <Route path="/engineering/dcl" element={<RequireSpace space="engineering"><DclPage /></RequireSpace>} />
                  <Route path="/engineering/serial-map" element={<RequireSpace space="engineering"><SerialMapPage /></RequireSpace>} />
                  <Route path="/engineering/serial-map-v2" element={<RequireSpace space="engineering"><SerialMapV2Page /></RequireSpace>} />
                  <Route path="/engineering/network-map" element={<RequireSpace space="engineering"><NetworkMapPage /></RequireSpace>} />
                  <Route path="/maintenance/incidents" element={<RequireSpace space="maintenance"><MntIncidentsPage /></RequireSpace>} />
                  <Route path="/maintenance/work-orders" element={<RequireSpace space="maintenance"><MntWorkOrdersPage /></RequireSpace>} />
                  <Route path="/maintenance/plans" element={<RequireSpace space="maintenance"><MntPlansPage /></RequireSpace>} />
                  <Route path="/maintenance/operating-time" element={<RequireSpace space="maintenance"><MntOperatingTimePage /></RequireSpace>} />
                  <Route path="/maintenance/reliability" element={<RequireSpace space="maintenance"><MntReliabilityPage /></RequireSpace>} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/personnel" element={<RequireSpace space="personnel"><PersonnelPage /></RequireSpace>} />
                  <Route path="/personnel/schedule" element={<RequireSpace space="personnel"><PersonnelSchedulePage /></RequireSpace>} />
                  <Route path="/personnel/:id" element={<RequireSpace space="personnel"><PersonnelDetailsPage /></RequireSpace>} />
                  <Route path="/admin/users" element={<RequireSpace space="admin_users" action="admin"><UsersPage /></RequireSpace>} />
                  <Route path="/admin/role-permissions" element={<RequireSpace space="admin_users" action="admin"><RolePermissionsPage /></RequireSpace>} />
                  <Route path="/admin/sessions" element={<RequireSpace space="admin_sessions"><SessionsPage /></RequireSpace>} />
                  <Route path="/admin/audit" element={<RequireSpace space="admin_audit"><AuditLogsPage /></RequireSpace>} />
                  <Route path="/admin/diagnostics" element={<RequireSpace space="admin_diagnostics"><AdminDiagnosticsPage /></RequireSpace>} />
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
