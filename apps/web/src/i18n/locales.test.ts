import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_LOCALE, WEB_LOCALE_OPTIONS, localeDirection, parseWebLocale } from "./locales";
import { messageFor } from "./messages";

describe("Web locale contract", () => {
  it("keeps English as the deterministic fallback", () => {
    expect(DEFAULT_WEB_LOCALE).toBe("en");
    expect(parseWebLocale(undefined)).toBe("en");
    expect(parseWebLocale("unknown")).toBe("en");
  });

  it("offers the requested five UI locales and uses RTL only for Arabic", () => {
    expect(WEB_LOCALE_OPTIONS.map((option) => option.code)).toEqual([
      "en",
      "zh-CN",
      "es",
      "ar",
      "ru",
    ]);
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("ru")).toBe("ltr");
  });

  it("has a typed UI translation for each shared and traveler-utility message", () => {
    for (const option of WEB_LOCALE_OPTIONS) {
      expect(messageFor(option.code, "nav.visepanda")).not.toEqual("");
      expect(messageFor(option.code, "home.title")).not.toEqual("");
      expect(messageFor(option.code, "workspace.initialMessage")).not.toEqual("");
      expect(messageFor(option.code, "rescue.title")).not.toEqual("");
      expect(messageFor(option.code, "help.submit")).not.toEqual("");
      expect(messageFor(option.code, "arrival.title")).not.toEqual("");
      expect(messageFor(option.code, "readiness.title")).not.toEqual("");
    }
  });
});
