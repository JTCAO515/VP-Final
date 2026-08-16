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
  type WebLocale,
} from "./locales";
import { messageFor, type MessageKey } from "./messages";

type LocaleContextValue = Readonly<{
  locale: WebLocale;
  setLocale: (locale: WebLocale) => void;
  t: (key: MessageKey) => string;
}>;

const defaultContext: LocaleContextValue = {
  locale: DEFAULT_WEB_LOCALE,
  setLocale: () => undefined,
  t: (key) => messageFor(DEFAULT_WEB_LOCALE, key),
};

const LocaleContext = createContext<LocaleContextValue>(defaultContext);

export function LocaleProvider({
  children,
  initialLocale,
}: Readonly<{
  children: ReactNode;
  initialLocale: WebLocale;
}>) {
  const [locale, setLocaleState] = useState<WebLocale>(initialLocale);

  const setLocale = useCallback((nextLocale: WebLocale) => {
    const normalized = parseWebLocale(nextLocale);
    document.cookie = `${WEB_LOCALE_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocaleState(normalized);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => messageFor(locale, key) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
