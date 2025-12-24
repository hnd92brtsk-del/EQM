import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ru from "./locales/ru.json";
import en from "./locales/en.json";

const STORAGE_KEY = "eqm.lang";

const getInitialLanguage = () => {
  if (typeof window === "undefined") {
    return "ru";
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored;
  }
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "ru";
};

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en }
  },
  lng: getInitialLanguage(),
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false
  }
});

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
