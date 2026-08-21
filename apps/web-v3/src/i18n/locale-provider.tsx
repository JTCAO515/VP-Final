"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_WEB_LOCALE,
  WEB_LOCALE_COOKIE,
  localeDirection,
  parseWebLocale,
  parseWebLocaleCookie,
  type WebLocale,
} from "./locales";

type LocaleContextValue = Readonly<{
  locale: WebLocale;
  setLocale: (locale: WebLocale) => void;
}>;

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_WEB_LOCALE,
  setLocale: () => undefined,
});

export function LocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocaleState] = useState<WebLocale>(DEFAULT_WEB_LOCALE);

  useEffect(() => setLocaleState(parseWebLocaleCookie(document.cookie)), []);

  const setLocale = useCallback((nextLocale: WebLocale) => {
    const normalized = parseWebLocale(nextLocale);
    document.cookie = `${WEB_LOCALE_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocaleState(normalized);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
