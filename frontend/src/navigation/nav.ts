import type { SvgIconComponent } from "@mui/icons-material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { AdminGearIcon, CabinetIcon, IndexIcon, NumbersSignalIcon, WarehouseIcon } from "../icons";

export type NavRole = "viewer" | "engineer" | "admin";

export type NavItem = {
  id: string;
  labelKey: string;
  labelRu?: string;
  labelEn?: string;
  path?: string;
  icon?: SvgIconComponent;
  children?: NavItem[];
  roles?: NavRole[];
  showInMenu?: boolean;
};

export const navTree: NavItem[] = [
  {
    id: "overview",
    labelKey: "menu.overview",
    labelRu: "Обзор",
    labelEn: "Overview",
    path: "/dashboard",
    icon: IndexIcon,
    roles: ["viewer", "engineer", "admin"]
  },
  {
    id: "equipment",
    labelKey: "menu.equipment",
    labelRu: "Оборудование",
    labelEn: "Equipment",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "warehouse-items",
        labelKey: "menu.warehouse_items",
        labelRu: "Складские позиции",
        labelEn: "Warehouse Items",
        path: "/warehouse-items",
        icon: WarehouseIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "cabinet-items",
        labelKey: "menu.cabinet_items",
        labelRu: "Шкафные позиции",
        labelEn: "Cabinet Items",
        path: "/cabinet-items",
        icon: CabinetIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "movements",
        labelKey: "menu.movements",
        labelRu: "Перемещения",
        labelEn: "Movements",
        path: "/movements",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "cabinets-group",
    labelKey: "menu.cabinets_group",
    labelRu: "Шкафы",
    labelEn: "Cabinets",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "cabinets",
        labelKey: "menu.cabinets",
        labelRu: "Cabinets",
        labelEn: "Cabinets",
        path: "/cabinets",
        icon: CabinetIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "cabinet-composition",
        labelKey: "menu.cabinet_composition",
        labelRu: "Состав шкафа",
        labelEn: "Cabinet Composition",
        path: "/cabinets/:id/composition",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "engineering",
    labelKey: "menu.engineering",
    labelRu: "Engineering",
    labelEn: "Engineering",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "io-signals",
        labelKey: "menu.io_signals",
        labelRu: "IO Signals",
        labelEn: "IO Signals",
        path: "/io-signals",
        icon: NumbersSignalIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "dcl",
        labelKey: "menu.dcl",
        labelRu: "DCL",
        labelEn: "DCL",
        path: "/engineering/dcl",
        icon: NumbersSignalIcon,
        roles: ["viewer", "engineer", "admin"]
      }
    ]
  },
  {
    id: "dictionaries",
    labelKey: "menu.dictionaries",
    labelRu: "Справочники",
    labelEn: "Dictionaries",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "warehouses",
        labelKey: "menu.warehouses",
        labelRu: "Warehouses",
        labelEn: "Warehouses",
        path: "/warehouses",
        icon: WarehouseIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "manufacturers",
        labelKey: "menu.manufacturers",
        labelRu: "Manufacturers",
        labelEn: "Manufacturers",
        path: "/dictionaries/manufacturers",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "nomenclature",
        labelKey: "menu.nomenclature",
        labelRu: "Номенклатура",
        labelEn: "Nomenclature",
        path: "/dictionaries/equipment-types",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "locations",
        labelKey: "menu.locations",
        labelRu: "Locations",
        labelEn: "Locations",
        path: "/dictionaries/locations",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "equipment-categories",
        labelKey: "menu.equipment_categories",
        labelRu: "Типы оборудования",
        labelEn: "Equipment Categories",
        path: "/dictionaries/equipment-categories",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "admin",
    labelKey: "menu.admin",
    labelRu: "Admin",
    labelEn: "Admin",
    roles: ["admin"],
    children: [
      {
        id: "admin-users",
        labelKey: "menu.admin_users",
        labelRu: "Users",
        labelEn: "Users",
        path: "/admin/users",
        icon: AdminGearIcon,
        roles: ["admin"]
      },
      {
        id: "admin-sessions",
        labelKey: "menu.admin_sessions",
        labelRu: "Sessions",
        labelEn: "Sessions",
        path: "/admin/sessions",
        icon: AdminGearIcon,
        roles: ["admin"]
      },
      {
        id: "admin-audit",
        labelKey: "menu.admin_audit",
        labelRu: "Audit Logs",
        labelEn: "Audit Logs",
        path: "/admin/audit",
        icon: AdminGearIcon,
        roles: ["admin"]
      }
    ]
  },
  {
    id: "help",
    labelKey: "menu.help",
    labelRu: "Помощь",
    labelEn: "Help",
    path: "/help",
    icon: HelpOutlineRoundedIcon,
    roles: ["viewer", "engineer", "admin"],
    showInMenu: false
  }
];

export const isAllowedForRole = (item: NavItem, role?: NavRole) => {
  if (!item.roles || item.roles.length === 0) {
    return true;
  }
  if (!role) {
    return false;
  }
  return item.roles.includes(role);
};

const matchPathPattern = (pattern: string, pathname: string) => {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  return patternParts.every((part, index) => {
    if (part.startsWith(":")) {
      return pathParts[index].length > 0;
    }
    return part === pathParts[index];
  });
};

export const findNavChain = (pathname: string, items: NavItem[], role?: NavRole): NavItem[] => {
  for (const item of items) {
    if (!isAllowedForRole(item, role)) {
      continue;
    }
    const childChain = item.children ? findNavChain(pathname, item.children, role) : [];
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
