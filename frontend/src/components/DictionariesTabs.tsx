import { Tabs, Tab } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const tabs = [
  { labelKey: "menu.manufacturers", to: "/dictionaries/manufacturers" },
  { labelKey: "menu.locations", to: "/dictionaries/locations" },
  { labelKey: "menu.field_equipments", to: "/dictionaries/field-equipments" },
  { labelKey: "menu.main_equipment", to: "/dictionaries/main-equipment" },
  { labelKey: "menu.data_types", to: "/dictionaries/data-types" },
  { labelKey: "menu.measurement_units", to: "/dictionaries/measurement-units" },
  { labelKey: "menu.signal_types", to: "/dictionaries/signal-types" },
  { labelKey: "menu.equipment_categories", to: "/dictionaries/equipment-categories" }
];

export function DictionariesTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const current =
    tabs.find((item) => location.pathname.startsWith(item.to))?.to ?? tabs[0].to;

  return (
    <Tabs
      value={current}
      onChange={(_, value) => navigate(value)}
      sx={{ borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
    >
      {tabs.map((tab) => (
        <Tab key={tab.to} label={t(tab.labelKey)} value={tab.to} />
      ))}
    </Tabs>
  );
}
