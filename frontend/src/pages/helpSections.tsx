import type { TFunction } from "i18next";

import { getAdminHelpSection } from "./help/AdminHelpSection";
import { getCabinetsHelpSection } from "./help/CabinetsHelpSection";
import { getDictionariesHelpSection } from "./help/DictionariesHelpSection";
import { getEngineeringHelpSection } from "./help/EngineeringHelpSection";
import { getEquipmentHelpSection } from "./help/EquipmentHelpSection";
import { getOverviewHelpSection } from "./help/OverviewHelpSection";
import { getPersonnelHelpSection } from "./help/PersonnelHelpSection";
import type { HelpLanguage } from "./help/builders";
import type { HelpSection } from "./help/types";

function normalizeLanguage(language: string): HelpLanguage {
  return language.startsWith("ru") ? "ru" : "en";
}

export const getHelpSections = (t: TFunction, language: string): HelpSection[] => {
  const locale = normalizeLanguage(language);

  return [
    getOverviewHelpSection(locale, t("menu.overview")),
    getPersonnelHelpSection(locale, t("menu.personnel")),
    getEquipmentHelpSection(locale, t("menu.equipment")),
    getCabinetsHelpSection(locale, t("menu.cabinets_group")),
    getEngineeringHelpSection(locale, t("menu.engineering")),
    getDictionariesHelpSection(locale, t("menu.dictionaries")),
    getAdminHelpSection(locale, t("menu.admin"))
  ];
};
