import { Box, Typography } from "@mui/material";
import type { TFunction } from "i18next";

import { getAdminDiagnosticsHelpSection } from "./help/AdminDiagnosticsHelpSection";
import type { HelpSection } from "./help/types";

type Language = "ru" | "en";

function normalizeLanguage(language: string): Language {
  return language.startsWith("ru") ? "ru" : "en";
}

function buildSimpleSection(id: string, title: string, content: string, secondary?: string): HelpSection {
  const body = secondary ? `${content} ${secondary}` : content;
  return {
    id,
    title,
    searchEntries: [
      {
        id: `${id}-summary`,
        sectionId: id,
        anchorId: id,
        title,
        body,
        keywords: [title]
      }
    ],
    content: (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="body1">{content}</Typography>
        {secondary ? (
          <Typography variant="body2" color="text.secondary">
            {secondary}
          </Typography>
        ) : null}
      </Box>
    )
  };
}

export const getHelpSections = (t: TFunction, language: string): HelpSection[] => {
  const locale = normalizeLanguage(language);
  const diagnosticsHelp = getAdminDiagnosticsHelpSection(locale);

  return [
    buildSimpleSection("overview", t("menu.overview"), t("help.overview")),
    buildSimpleSection("personnel", t("menu.personnel"), t("help.personnel_overview"), t("help.personnel_details")),
    buildSimpleSection(
      "equipment-warehouse-items",
      `${t("menu.equipment")} / ${t("menu.warehouse_items")}`,
      t("help.equipmentWarehouseItems"),
      t("help.equipmentWarehouseItemsSecondary")
    ),
    buildSimpleSection("equipment-cabinet-items", `${t("menu.equipment")} / ${t("menu.cabinet_items")}`, t("help.equipmentCabinetItems")),
    buildSimpleSection("cabinets", `${t("menu.cabinets_group")} / ${t("menu.cabinets")}`, t("help.cabinets")),
    buildSimpleSection("cabinet-composition", `${t("menu.cabinets_group")} / ${t("menu.cabinet_composition")}`, t("help.cabinetComposition")),
    buildSimpleSection("engineering", t("menu.engineering"), t("help.engineering"), t("help.engineeringSecondary")),
    buildSimpleSection("personnel-schedule", `${t("menu.personnel")} / ${t("menu.personnel_schedule")}`, t("help.personnel_schedule")),
    buildSimpleSection("network-map", `${t("menu.engineering")} / ${t("menu.network_map")}`, t("help.networkMap"), t("help.networkMapSecondary")),
    buildSimpleSection("main-equipment", `${t("menu.dictionaries")} / ${t("menu.main_equipment")}`, t("help.main_equipment")),
    buildSimpleSection("field-equipments", `${t("menu.dictionaries")} / ${t("menu.field_equipments")}`, t("help.field_equipments")),
    buildSimpleSection("data-types", `${t("menu.dictionaries")} / ${t("menu.data_types")}`, t("help.data_types")),
    buildSimpleSection("dictionaries", t("menu.dictionaries"), t("help.dictionaries")),
    {
      id: "admin",
      title: t("menu.admin"),
      anchors: diagnosticsHelp.anchors,
      searchEntries: [
        {
          id: "admin-summary",
          sectionId: "admin",
          anchorId: "admin",
          title: t("menu.admin"),
          body: `${t("help.admin")} ${locale === "ru" ? "Диагностика, пользователи, сессии, журнал аудита, запуск, останов, ошибки, PostgreSQL, backend, frontend." : "Diagnostics, users, sessions, audit log, startup, shutdown, errors, PostgreSQL, backend, frontend."}`,
          keywords: [t("menu.admin"), t("menu.admin_diagnostics")]
        },
        ...diagnosticsHelp.searchEntries
      ],
      content: (
        <Box sx={{ display: "grid", gap: 3 }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography variant="body1">{t("help.admin")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {locale === "ru"
                ? "Раздел ниже посвящён экрану `Admin -> Диагностика` и рассчитан на администратора, который только начинает работать с эксплуатацией системы."
                : "The section below is dedicated to the `Admin -> Diagnostics` screen and is written for an administrator who is just starting to operate the system."}
            </Typography>
          </Box>
          {diagnosticsHelp.content}
        </Box>
      )
    }
  ];
};
