"use client";

import { useEffect, useState } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { useUIStore } from "@/store/auth.store";

export type Language = "fr" | "ar" | "en";

const SUPPORTED_LANGUAGES: Language[] = ["fr", "ar", "en"];

function isLanguage(value: string | null | undefined): value is Language {
  return !!value && SUPPORTED_LANGUAGES.includes(value as Language);
}

function getCookieLanguage(): Language | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("atlas_lang="))
    ?.split("=")[1];

  if (!match) {
    return null;
  }

  const decoded = decodeURIComponent(match);
  return isLanguage(decoded) ? decoded : null;
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "fr";
  }

  const cookieLang = getCookieLanguage();
  if (cookieLang) {
    return cookieLang;
  }

  const stored = localStorage.getItem("atlas_lang");
  if (isLanguage(stored)) {
    return stored;
  }

  return "fr";
}

interface RTLContext {
  dir: "ltr" | "rtl";
  isRTL: boolean;
  lang: Language;
  setLanguage: (lang: Language) => void;
  languageNames: Record<Language, string>;
}

function applyDocumentLanguage(lang: Language, setRTL: (rtl: boolean) => void) {
  const rtl = lang === "ar";
  setRTL(rtl);
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
}

export function useRTL(): RTLContext {
  const { isRTL, setRTL } = useUIStore();
  const [lang, setLangState] = useState<Language>(getInitialLanguage);

  const setLanguage = (nextLang: Language) => {
    setLangState(nextLang);
    localStorage.setItem("atlas_lang", nextLang);
    document.cookie = `atlas_lang=${encodeURIComponent(nextLang)}; path=/; max-age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    applyDocumentLanguage(lang, setRTL);
  }, [lang, setRTL]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "atlas_lang") {
        return;
      }

      if (isLanguage(event.newValue)) {
        setLangState(event.newValue);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    dir: isRTL ? "rtl" : "ltr",
    isRTL,
    lang,
    setLanguage,
    languageNames: {
      fr: "Francais",
      ar: "Arabic",
      en: "English",
    },
  };
}

export function useTheme() {
  const { theme, setTheme: setStoredTheme } = useUIStore();
  const { resolvedTheme, setTheme: setNextTheme } = useNextTheme();

  return {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: "light" | "dark" | "system") => {
      setStoredTheme(nextTheme);
      setNextTheme(nextTheme);
    },
  };
}
