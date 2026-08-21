"use client";

import { WEB_LOCALE_OPTIONS, type WebLocale } from "./locales";
import { useLocale } from "./locale-provider";

export function LanguageSelector({ label }: Readonly<{ label: string }>) {
  const { locale, setLocale } = useLocale();

  return (
    <label className="relative inline-flex min-h-11 items-center rounded-brand-sm border border-brand-line bg-brand-surface px-3 text-sm font-semibold text-brand-ink shadow-brand-sm transition-colors focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red-soft">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="min-h-11 cursor-pointer appearance-none bg-brand-surface pe-6 text-brand-ink outline-none"
        onChange={(event) => setLocale(event.target.value as WebLocale)}
        value={locale}
      >
        {WEB_LOCALE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute end-3 text-brand-muted">
        ↓
      </span>
    </label>
  );
}
