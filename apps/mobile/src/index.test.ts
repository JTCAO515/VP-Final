import { expect, it } from "vitest";

import { mobileTheme } from "./index.js";

it("re-exports the shared Native-ready theme for the Expo shell", () => {
  expect(mobileTheme.components.button.minHeight).toBe(44);
  expect(mobileTheme.colors.primary).toBe("#b92420");
});
