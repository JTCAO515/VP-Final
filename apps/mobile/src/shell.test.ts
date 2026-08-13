import { expect, it } from "vitest";

import { isMobileTab, MOBILE_TAB_LABELS, MOBILE_TABS } from "./shell.js";

it("keeps the execute-stage shell limited to its four declared tabs", () => {
  expect(MOBILE_TABS).toEqual(["today", "tools", "help", "me"]);
  expect(MOBILE_TAB_LABELS.tools).toBe("Tools");
  expect(isMobileTab("help")).toBe(true);
  expect(isMobileTab("copilot")).toBe(false);
});
