import { expect, it } from "vitest";
import { contrastRatio, designTokenCss, designTokens, nativeDesignTokens } from "./index.js";

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

it("derives Native colors, dimensions, and semantic states from the canonical tokens", () => {
  expect(nativeDesignTokens.colors.primary).toBe(designTokens.primary);
  expect(nativeDesignTokens.colors.foilGold).toBe(designTokens.foilGold);
  expect(nativeDesignTokens.spacing[4]).toBe(16);
  expect(nativeDesignTokens.radii.md).toBe(12);
  expect(nativeDesignTokens.typography.sizes.md).toBe(16);
  expect(nativeDesignTokens.components.button).toMatchObject({
    backgroundColor: designTokens.primary,
    color: designTokens.onPrimary,
    minHeight: 44,
  });
  expect(nativeDesignTokens.components.status.ready).toEqual({
    color: designTokens.success,
    backgroundColor: designTokens.successSoft,
  });
});
