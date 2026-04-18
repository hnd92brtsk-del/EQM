import type { SvgIconComponent } from "@mui/icons-material";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import PeopleOutlineRoundedIcon from "@mui/icons-material/PeopleOutlineRounded";

import type { AuthUser } from "../api/auth";
import { AdminGearIcon, CabinetIcon, IndexIcon, NumbersSignalIcon, WarehouseIcon } from "../icons";
import { hasPermission, type PermissionAction, type SpaceKey } from "../utils/permissions";

export type NavItem = {
  id: string;
  labelKey: string;
  path?: string;
  icon?: SvgIconComponent;
  children?: NavItem[];
  requiredSpace?: SpaceKey;
  requiredAction?: PermissionAction;
  showInMenu?: boolean;
};

export const navTree: NavItem[] = [
  { id: "overview", labelKey: "menu.overview", path: "/dashboard", icon: IndexIcon, requiredSpace: "overview" },
  {
    id: "personnel",
    labelKey: "menu.personnel",
    requiredSpace: "personnel",
    children: [
      { id: "personnel-list", labelKey: "menu.personnel_list", path: "/personnel", icon: PeopleOutlineRoundedIcon, requiredSpace: "personnel" },
      { id: "personnel-schedule", labelKey: "menu.personnel_schedule", path: "/personnel/schedule", icon: PeopleOutlineRoundedIcon, requiredSpace: "personnel" }
    ]
  },
  { id: "personnel-details", labelKey: "pages.personnel_details", path: "/personnel/:id", requiredSpace: "personnel", showInMenu: false },
  {
    id: "equipment",
    labelKey: "menu.equipment",
    requiredSpace: "equipment",
    children: [
      { id: "nomenclature", labelKey: "menu.nomenclature", path: "/dictionaries/equipment-types", icon: IndexIcon, requiredSpace: "equipment" },
      { id: "technological-equipment", labelKey: "menu.technological_equipment", path: "/equipment/technological", icon: IndexIcon, requiredSpace: "equipment" },
      { id: "warehouse-items", labelKey: "menu.warehouse_items", path: "/warehouse-items", icon: WarehouseIcon, requiredSpace: "equipment" },
      { id: "cabinet-items", labelKey: "menu.cabinet_items", path: "/cabinet-items", icon: CabinetIcon, requiredSpace: "equipment" },
      { id: "movements", labelKey: "menu.movements", path: "/movements", requiredSpace: "equipment", showInMenu: false }
    ]
  },
  {
    id: "cabinets-group",
    labelKey: "menu.cabinets_group",
    requiredSpace: "cabinets",
    children: [
      { id: "cabinets", labelKey: "menu.cabinets", path: "/cabinets", icon: CabinetIcon, requiredSpace: "cabinets" },
      { id: "assemblies", labelKey: "menu.assemblies", path: "/assemblies", icon: CabinetIcon, requiredSpace: "cabinets" },
      { id: "cabinet-composition", labelKey: "menu.cabinet_composition", path: "/cabinets/:id/composition", requiredSpace: "cabinets", showInMenu: false },
      { id: "assembly-composition", labelKey: "menu.cabinet_composition", path: "/assemblies/:id/composition", requiredSpace: "cabinets", showInMenu: false }
    ]
  },
  {
    id: "engineering",
    labelKey: "menu.engineering",
    requiredSpace: "engineering",
    children: [
      { id: "technological-scheme", labelKey: "menu.technological_scheme", path: "/engineering/technological-scheme", icon: IndexIcon, requiredSpace: "engineering" },
      { id: "io-signals", labelKey: "menu.io_signals", path: "/io-signals", icon: NumbersSignalIcon, requiredSpace: "engineering" },
      { id: "ipam", labelKey: "menu.ipam", path: "/ipam", icon: NumbersSignalIcon, requiredSpace: "engineering" },
      { id: "dcl", labelKey: "menu.dcl", path: "/engineering/dcl", icon: NumbersSignalIcon, requiredSpace: "engineering" },
      { id: "serial-map", labelKey: "menu.serial_map", path: "/engineering/serial-map", icon: NumbersSignalIcon, requiredSpace: "engineering" },
      { id: "serial-map-v2", labelKey: "menu.serial_map_v2", path: "/engineering/serial-map-v2", icon: NumbersSignalIcon, requiredSpace: "engineering" },
      { id: "network-map", labelKey: "menu.network_map", path: "/engineering/network-map", icon: NumbersSignalIcon, requiredSpace: "engineering" }
    ]
  },
  {
    id: "maintenance",
    labelKey: "menu.maintenance",
    requiredSpace: "maintenance",
    children: [
      { id: "mnt-incidents", labelKey: "menu.mnt_incidents", path: "/maintenance/incidents", icon: BuildRoundedIcon, requiredSpace: "maintenance" },
      { id: "mnt-work-orders", labelKey: "menu.mnt_work_orders", path: "/maintenance/work-orders", icon: BuildRoundedIcon, requiredSpace: "maintenance" },
      { id: "mnt-plans", labelKey: "menu.mnt_plans", path: "/maintenance/plans", icon: BuildRoundedIcon, requiredSpace: "maintenance" },
      { id: "mnt-operating-time", labelKey: "menu.mnt_operating_time", path: "/maintenance/operating-time", icon: BuildRoundedIcon, requiredSpace: "maintenance" },
      { id: "mnt-reliability", labelKey: "menu.mnt_reliability", path: "/maintenance/reliability", icon: BuildRoundedIcon, requiredSpace: "maintenance" },
    ]
  },
  {
    id: "dictionaries",
    labelKey: "menu.dictionaries",
    requiredSpace: "dictionaries",
    children: [
      { id: "warehouses", labelKey: "menu.warehouses", path: "/warehouses", icon: WarehouseIcon, requiredSpace: "dictionaries" },
      { id: "manufacturers", labelKey: "menu.manufacturers", path: "/dictionaries/manufacturers", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "locations", labelKey: "menu.locations", path: "/dictionaries/locations", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "main-equipment", labelKey: "menu.main_equipment", path: "/dictionaries/main-equipment", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "data-types", labelKey: "menu.data_types", path: "/dictionaries/data-types", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "measurement-units", labelKey: "menu.measurement_units", path: "/dictionaries/measurement-units", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "signal-types", labelKey: "menu.signal_types", path: "/dictionaries/signal-types", icon: IndexIcon, requiredSpace: "dictionaries" },
      { id: "equipment-categories", labelKey: "menu.equipment_categories", path: "/dictionaries/equipment-categories", icon: IndexIcon, requiredSpace: "dictionaries" }
    ]
  },
  {
    id: "admin",
    labelKey: "menu.admin",
    requiredSpace: "admin_users",
    requiredAction: "admin",
    children: [
      { id: "admin-users", labelKey: "menu.admin_users", path: "/admin/users", icon: AdminGearIcon, requiredSpace: "admin_users", requiredAction: "admin" },
      { id: "admin-role-permissions", labelKey: "menu.admin_role_permissions", path: "/admin/role-permissions", icon: AdminGearIcon, requiredSpace: "admin_users", requiredAction: "admin" },
      { id: "admin-sessions", labelKey: "menu.admin_sessions", path: "/admin/sessions", icon: AdminGearIcon, requiredSpace: "admin_sessions" },
      { id: "admin-audit", labelKey: "menu.admin_audit", path: "/admin/audit", icon: AdminGearIcon, requiredSpace: "admin_audit" },
      { id: "admin-diagnostics", labelKey: "menu.admin_diagnostics", path: "/admin/diagnostics", icon: AdminGearIcon, requiredSpace: "admin_diagnostics" }
    ]
  },
  { id: "help", labelKey: "menu.help", path: "/help", icon: HelpOutlineRoundedIcon, requiredSpace: "overview", showInMenu: false }
];

export const isAllowedForUser = (item: NavItem, user?: AuthUser | null) => {
  if (!item.requiredSpace) {
    return true;
  }
  return hasPermission(user, item.requiredSpace, item.requiredAction ?? "read");
};

const matchPathPattern = (pattern: string, pathname: string) => {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  return patternParts.every((part, index) => (part.startsWith(":") ? pathParts[index].length > 0 : part === pathParts[index]));
};

export const findNavChain = (pathname: string, items: NavItem[], user?: AuthUser | null): NavItem[] => {
  for (const item of items) {
    if (!isAllowedForUser(item, user)) {
      continue;
    }
    const childChain = item.children ? findNavChain(pathname, item.children, user) : [];
    const matchesPath = item.path ? matchPathPattern(item.path, pathname) : false;
    if (matchesPath) {
      return [item];
    }
    if (childChain.length > 0) {
      return [item, ...childChain];
    }
  }
  return [];
};
