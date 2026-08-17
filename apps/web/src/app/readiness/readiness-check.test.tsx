import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  answerLabel,
  ReadinessCheck,
  statusLabel,
  summarizeReadinessItems,
} from "./readiness-check";
import { LocaleProvider } from "../../i18n/locale-provider";
import { WEB_LOCALE_OPTIONS } from "../../i18n/locales";
import { messageFor } from "../../i18n/messages";

describe("China Readiness Check", () => {
  it("does not create a percentage score or commercial CTA", () => {
    const html = renderWithReact(React.createElement(ReadinessCheck));

    expect(html).toContain("China Readiness Check");
    expect(html).toContain("10 fixed checks");
    expect(html).toContain("No percentage score");
    expect(html).toContain("Unknown stays unknown");
    expect(html).toContain("Save this self-report");
    expect(html).toContain('class="readinessResultSummary"');
    expect(html).not.toContain("<details");
    expect(html).not.toContain("% ready");
    expect(html).not.toContain("Book now");
    expect(html).not.toContain("Partner");
  });

  it("labels missing values as unknown instead of silently treating them as ready", () => {
    expect(answerLabel("unknown", true)).toBe("Not answered (unknown)");
    expect(answerLabel("confirmed", false)).toBe("Confirmed");
    expect(answerLabel("not_confirmed", false)).toBe("Not yet");
    expect(statusLabel("unknown")).toBe("Unknown");
    expect(statusLabel("action_required")).toBe("Action needed");
  });

  it("summarizes each status without changing the underlying readiness result", () => {
    expect(
      summarizeReadinessItems([
        { status: "ready" },
        { status: "action_required" },
        { status: "unknown" },
        { status: "unknown" },
      ]),
    ).toEqual({ ready: 1, actionRequired: 1, unknown: 2 });
  });

  it("renders every authored Readiness chrome label from the selected locale catalog", () => {
    for (const option of WEB_LOCALE_OPTIONS) {
      const html = renderWithReact(
        React.createElement(LocaleProvider, {
          initialLocale: option.code,
          children: React.createElement(ReadinessCheck),
        }),
      );

      expect(html).toContain(messageFor(option.code, "readiness.lead"));
      expect(html).toContain(messageFor(option.code, "readiness.fixedChecks"));
      expect(html).toContain(messageFor(option.code, "readiness.answer.confirmed"));
      expect(html).toContain(messageFor(option.code, "readiness.result.explainable"));
      expect(html).toContain(messageFor(option.code, "readiness.saveLead"));
    }
  });
});

function renderWithReact(element: React.ReactElement) {
  const runtimeGlobal = globalThis as typeof globalThis & { React?: typeof React };
  runtimeGlobal.React = React;
  try {
    return renderToStaticMarkup(element);
  } finally {
    delete runtimeGlobal.React;
  }
}
