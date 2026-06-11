import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./vi.json";
import en from "./en.json";

const STORAGE_KEY = "cs2t_lang";

function getInitialLanguage(): string {
  if (typeof window === "undefined") return "vi";
  return localStorage.getItem(STORAGE_KEY) || "vi";
}

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function changeLanguage(lang: "vi" | "en") {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  // Update <html lang> attribute for SEO
  document.documentElement.lang = lang;
}

export default i18n;
