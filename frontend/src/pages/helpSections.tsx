import { Box, Typography } from "@mui/material";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";

export type HelpSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export const getHelpSections = (t: TFunction): HelpSection[] => [
  {
    id: "overview",
    title: t("menu.overview"),
    content: (
      <Typography variant="body1">
        The overview is a read-only dashboard with KPI cards, charts, and summary tables.
        It provides a snapshot of the system and does not allow editing records directly.
      </Typography>
    )
  },
  {
    id: "personnel",
    title: t("menu.personnel"),
    content: (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body1">{t("help.personnel_overview")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("help.personnel_details")}
        </Typography>
      </Box>
    )
  },
  {
    id: "equipment-warehouse-items",
    title: `${t("menu.equipment")} / ${t("menu.warehouse_items")}`,
    content: (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body1">
          This table lists warehouse stock items. Use search, filters, and sorting to find
          positions quickly. Add, edit, delete, and restore actions are available.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Movement actions such as inbound and transfer are initiated from this area.
        </Typography>
      </Box>
    )
  },
  {
    id: "equipment-cabinet-items",
    title: `${t("menu.equipment")} / ${t("menu.cabinet_items")}`,
    content: (
      <Typography variant="body1">
        Cabinet items show equipment stored in cabinets. Use the same list tools:
        search, filters, sorting, and actions to add, edit, delete, or restore entries.
      </Typography>
    )
  },
  {
    id: "cabinets",
    title: `${t("menu.cabinets_group")} / ${t("menu.cabinets")}`,
    content: (
      <Typography variant="body1">
        The cabinets list lets you manage cabinet records. Use add/edit/delete/restore
        actions and open a cabinet to view its composition.
      </Typography>
    )
  },
  {
    id: "cabinet-composition",
    title: `${t("menu.cabinets_group")} / ${t("menu.cabinet_composition")}`,
    content: (
      <Typography variant="body1">
        Cabinet composition is a dedicated view for the cabinet structure and items.
        It is a focused area for cabinet details and composition-related actions.
      </Typography>
    )
  },
  {
    id: "engineering",
    title: t("menu.engineering"),
    content: (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body1">
          Engineering includes IO Signals and DCL. These screens manage signals,
          connections, and related definitions using add/edit/delete/restore actions.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Use filters and sorting to navigate large signal lists.
        </Typography>
      </Box>
    )
  },
  {
    id: "dictionaries",
    title: t("menu.dictionaries"),
    content: (
      <Typography variant="body1">
        Dictionaries include Warehouses, Manufacturers, Nomenclature, Locations, and
        Equipment Categories. Records can be viewed, added, edited, deleted, and restored.
      </Typography>
    )
  },
  {
    id: "admin",
    title: t("menu.admin"),
    content: (
      <Typography variant="body1">
        Admin contains Users, Sessions, and Audit Logs. Access is limited to the admin role.
      </Typography>
    )
  }
];
