"use client";

import { WEB_LOCALE_OPTIONS } from "./locales";
import { useLocale } from "./locale-provider";

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="languageSelector">
      <span className="srOnly">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        value={locale}
      >
        {WEB_LOCALE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
