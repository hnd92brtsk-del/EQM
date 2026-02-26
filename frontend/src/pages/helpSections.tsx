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
        {t("help.overview")}
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
        <Typography variant="body1">{t("help.equipmentWarehouseItems")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("help.equipmentWarehouseItemsSecondary")}
        </Typography>
      </Box>
    )
  },
  {
    id: "equipment-cabinet-items",
    title: `${t("menu.equipment")} / ${t("menu.cabinet_items")}`,
    content: (
      <Typography variant="body1">
        {t("help.equipmentCabinetItems")}
      </Typography>
    )
  },
  {
    id: "cabinets",
    title: `${t("menu.cabinets_group")} / ${t("menu.cabinets")}`,
    content: (
      <Typography variant="body1">
        {t("help.cabinets")}
      </Typography>
    )
  },
  {
    id: "cabinet-composition",
    title: `${t("menu.cabinets_group")} / ${t("menu.cabinet_composition")}`,
    content: (
      <Typography variant="body1">
        {t("help.cabinetComposition")}
      </Typography>
    )
  },
  {
    id: "engineering",
    title: t("menu.engineering"),
    content: (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body1">{t("help.engineering")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("help.engineeringSecondary")}
        </Typography>
      </Box>
    )
  },
  {
    id: "main-equipment",
    title: `${t("menu.dictionaries")} / ${t("menu.main_equipment")}`,
    content: (
      <Typography variant="body1">
        {t("help.main_equipment")}
      </Typography>
    )
  },
  {
    id: "field-equipments",
    title: `${t("menu.dictionaries")} / ${t("menu.field_equipments")}`,
    content: (
      <Typography variant="body1">
        {t("help.field_equipments")}
      </Typography>
    )
  },
  {
    id: "data-types",
    title: `${t("menu.dictionaries")} / ${t("menu.data_types")}`,
    content: (
      <Typography variant="body1">
        {t("help.data_types")}
      </Typography>
    )
  },
  {
    id: "dictionaries",
    title: t("menu.dictionaries"),
    content: (
      <Typography variant="body1">
        {t("help.dictionaries")}
      </Typography>
    )
  },
  {
    id: "admin",
    title: t("menu.admin"),
    content: (
      <Typography variant="body1">
        {t("help.admin")}
      </Typography>
    )
  }
];
