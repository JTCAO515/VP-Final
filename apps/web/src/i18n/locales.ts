export const WEB_LOCALES = ["en", "zh-CN", "es", "ar", "ru"] as const;

export type WebLocale = (typeof WEB_LOCALES)[number];

export const DEFAULT_WEB_LOCALE: WebLocale = "en";
export const WEB_LOCALE_COOKIE = "visepanda_locale";

export type LocaleDirection = "ltr" | "rtl";

export type LocaleOption = Readonly<{
  code: WebLocale;
  label: string;
  nativeLabel: string;
  direction: LocaleDirection;
}>;

export const WEB_LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "en", label: "English", nativeLabel: "English", direction: "ltr" },
  { code: "zh-CN", label: "Chinese", nativeLabel: "中文", direction: "ltr" },
  { code: "es", label: "Spanish", nativeLabel: "Español", direction: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", direction: "rtl" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", direction: "ltr" },
] as const;

export function parseWebLocale(value: string | null | undefined): WebLocale {
  return WEB_LOCALES.includes(value as WebLocale) ? (value as WebLocale) : DEFAULT_WEB_LOCALE;
}

export function localeDirection(locale: WebLocale): LocaleDirection {
  return WEB_LOCALE_OPTIONS.find((option) => option.code === locale)?.direction ?? "ltr";
}

export function localeOption(locale: WebLocale): LocaleOption {
  return WEB_LOCALE_OPTIONS.find((option) => option.code === locale) ?? WEB_LOCALE_OPTIONS[0]!;
}
