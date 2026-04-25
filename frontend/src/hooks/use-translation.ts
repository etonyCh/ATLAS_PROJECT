"use client";

import { useLanguageContext } from "@/components/providers";
import { translations, Language } from "@/lib/translations";
import { useForceUpdate } from "@/hooks/use-force-update";

const allTranslations = translations as any;

export function useTranslation() {
  const { lang } = useLanguageContext();
  useForceUpdate();

  const t = (
    section: string,
    params?: Record<string, string | number>
  ): string => {
    const sections = section.split(".");
    let value: any = allTranslations[lang as Language];

    for (const key of sections) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        value = allTranslations.en;
        for (const k of sections) {
          if (value && typeof value === "object" && k in value) {
            value = value[k];
          } else {
            return section;
          }
        }
        break;
      }
    }

    if (typeof value !== "string") {
      return section;
    }

    let text = value;

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
      });
    }

    return text;
  };

  const tSection = (section: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const sectionData = allTranslations[lang as Language]?.[section] || allTranslations.en[section];

    if (sectionData && typeof sectionData === "object") {
      Object.entries(sectionData).forEach(([key, value]) => {
        if (typeof value === "object") {
          result[key] = value as any;
        } else if (typeof value === "string") {
          result[key] = value;
        }
      });
    }

    return result;
  };

  return { t, tSection, lang };
}