import { Tabs, Tab } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { label: "Производители", to: "/dictionaries/manufacturers" },
  { label: "Локации", to: "/dictionaries/locations" },
  { label: "Номенклатура", to: "/dictionaries/equipment-types" }
];

export function DictionariesTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const current =
    tabs.find((item) => location.pathname.startsWith(item.to))?.to ?? tabs[0].to;

  return (
    <Tabs
      value={current}
      onChange={(_, value) => navigate(value)}
      sx={{ borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
    >
      {tabs.map((tab) => (
        <Tab key={tab.to} label={tab.label} value={tab.to} />
      ))}
    </Tabs>
  );
}
