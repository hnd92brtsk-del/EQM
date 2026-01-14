import type { SvgIconComponent } from "@mui/icons-material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import PeopleOutlineRoundedIcon from "@mui/icons-material/PeopleOutlineRounded";
import { AdminGearIcon, CabinetIcon, IndexIcon, NumbersSignalIcon, WarehouseIcon } from "../icons";

export type NavRole = "viewer" | "engineer" | "admin";

export type NavItem = {
  id: string;
  labelKey: string;
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
    path: "/dashboard",
    icon: IndexIcon,
    roles: ["viewer", "engineer", "admin"]
  },
  {
    id: "personnel",
    labelKey: "menu.personnel",
    path: "/personnel",
    icon: PeopleOutlineRoundedIcon,
    roles: ["viewer", "engineer", "admin"]
  },
  {
    id: "personnel-details",
    labelKey: "pages.personnel_details",
    path: "/personnel/:id",
    roles: ["viewer", "engineer", "admin"],
    showInMenu: false
  },
  {
    id: "equipment",
    labelKey: "menu.equipment",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "nomenclature",
        labelKey: "menu.nomenclature",
        path: "/dictionaries/equipment-types",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "warehouse-items",
        labelKey: "menu.warehouse_items",
        path: "/warehouse-items",
        icon: WarehouseIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "cabinet-items",
        labelKey: "menu.cabinet_items",
        path: "/cabinet-items",
        icon: CabinetIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "movements",
        labelKey: "menu.movements",
        path: "/movements",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "cabinets-group",
    labelKey: "menu.cabinets_group",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "cabinets",
        labelKey: "menu.cabinets",
        path: "/cabinets",
        icon: CabinetIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "assemblies",
        labelKey: "menu.assemblies",
        path: "/assemblies",
        icon: CabinetIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "cabinet-composition",
        labelKey: "menu.cabinet_composition",
        path: "/cabinets/:id/composition",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "engineering",
    labelKey: "menu.engineering",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "io-signals",
        labelKey: "menu.io_signals",
        path: "/io-signals",
        icon: NumbersSignalIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "dcl",
        labelKey: "menu.dcl",
        path: "/engineering/dcl",
        icon: NumbersSignalIcon,
        roles: ["viewer", "engineer", "admin"]
      }
    ]
  },
  {
    id: "dictionaries",
    labelKey: "menu.dictionaries",
    roles: ["viewer", "engineer", "admin"],
    children: [
      {
        id: "warehouses",
        labelKey: "menu.warehouses",
        path: "/warehouses",
        icon: WarehouseIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "manufacturers",
        labelKey: "menu.manufacturers",
        path: "/dictionaries/manufacturers",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "locations",
        labelKey: "menu.locations",
        path: "/dictionaries/locations",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "measurement-units",
        labelKey: "menu.measurement_units",
        path: "/dictionaries/measurement-units",
        icon: IndexIcon,
        roles: ["viewer", "engineer", "admin"]
      },
      {
        id: "equipment-categories",
        labelKey: "menu.equipment_categories",
        path: "/dictionaries/equipment-categories",
        roles: ["viewer", "engineer", "admin"],
        showInMenu: false
      }
    ]
  },
  {
    id: "admin",
    labelKey: "menu.admin",
    roles: ["admin"],
    children: [
      {
        id: "admin-users",
        labelKey: "menu.admin_users",
        path: "/admin/users",
        icon: AdminGearIcon,
        roles: ["admin"]
      },
      {
        id: "admin-sessions",
        labelKey: "menu.admin_sessions",
        path: "/admin/sessions",
        icon: AdminGearIcon,
        roles: ["admin"]
      },
      {
        id: "admin-audit",
        labelKey: "menu.admin_audit",
        path: "/admin/audit",
        icon: AdminGearIcon,
        roles: ["admin"]
      }
    ]
  },
  {
    id: "help",
    labelKey: "menu.help",
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
