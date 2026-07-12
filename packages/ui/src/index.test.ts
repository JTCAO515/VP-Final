import { expect, it } from "vitest";
import { contrastRatio, designTokenCss, designTokens } from "./index.js";

it("exports every semantic design token as CSS custom properties", () => {
  expect(designTokenCss).toContain(":root{");
  expect(designTokenCss).toContain(`--vp-china-red:${designTokens.chinaRed}`);
  expect(designTokenCss).toContain(`--vp-shadow-raised:${designTokens.shadowRaised}`);
  expect(designTokenCss).toContain(`--vp-space-4:${designTokens.space4}`);
  expect(designTokenCss).toContain(`--vp-font-sans:${designTokens.fontSans}`);
});

it("keeps required text and status pairs at WCAG AA contrast", () => {
  const pairs: Array<[string, string]> = [
    [designTokens.ink, designTokens.background],
    [designTokens.onPrimary, designTokens.chinaRed],
    [designTokens.foilGoldDark, designTokens.foilGoldSoft],
    [designTokens.jade, designTokens.jadeSoft],
    [designTokens.river, designTokens.riverSoft],
  ];

  for (const [foreground, background] of pairs) {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  }
});
