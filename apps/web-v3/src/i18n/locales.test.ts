import { describe, expect, it } from "vitest";
import { localeDirection, parseWebLocale, parseWebLocaleCookie } from "./locales";

describe("Web V3 locales", () => {
  it("defaults unknown values to English and keeps Arabic RTL", () => {
    expect(parseWebLocale("unknown")).toBe("en");
    expect(localeDirection("en")).toBe("ltr");
    expect(localeDirection("ar")).toBe("rtl");
  });

  it("parses only the allowlisted locale cookie", () => {
    expect(parseWebLocaleCookie("other=1; visepanda_locale=zh-CN")).toBe("zh-CN");
    expect(parseWebLocaleCookie("visepanda_locale=%E0%A4%A")).toBe("en");
  });
});
