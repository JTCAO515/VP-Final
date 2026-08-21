export const WEB_LOCALES = ["en", "zh-CN", "es", "ar", "ru"] as const;

export type WebLocale = (typeof WEB_LOCALES)[number];
export type LocaleDirection = "ltr" | "rtl";

export const DEFAULT_WEB_LOCALE: WebLocale = "en";
export const WEB_LOCALE_COOKIE = "visepanda_locale";

export const WEB_LOCALE_OPTIONS = [
  { code: "en", nativeLabel: "English", direction: "ltr" },
  { code: "zh-CN", nativeLabel: "中文", direction: "ltr" },
  { code: "es", nativeLabel: "Español", direction: "ltr" },
  { code: "ar", nativeLabel: "العربية", direction: "rtl" },
  { code: "ru", nativeLabel: "Русский", direction: "ltr" },
] as const satisfies ReadonlyArray<{
  code: WebLocale;
  nativeLabel: string;
  direction: LocaleDirection;
}>;

export function parseWebLocale(value: string | null | undefined): WebLocale {
  return WEB_LOCALES.includes(value as WebLocale) ? (value as WebLocale) : DEFAULT_WEB_LOCALE;
}

export function parseWebLocaleCookie(cookieHeader: string): WebLocale {
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WEB_LOCALE_COOKIE}=`));

  if (!entry) return DEFAULT_WEB_LOCALE;
  try {
    return parseWebLocale(decodeURIComponent(entry.slice(WEB_LOCALE_COOKIE.length + 1)));
  } catch {
    return DEFAULT_WEB_LOCALE;
  }
}

export function localeDirection(locale: WebLocale): LocaleDirection {
  return WEB_LOCALE_OPTIONS.find((option) => option.code === locale)?.direction ?? "ltr";
}
