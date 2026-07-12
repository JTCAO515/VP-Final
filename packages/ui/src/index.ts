export type DesignTokenName =
  | "background"
  | "app"
  | "surface"
  | "surfaceWarm"
  | "surfaceRed"
  | "surfaceGold"
  | "ink"
  | "inkSoft"
  | "muted"
  | "faint"
  | "line"
  | "lineStrong"
  | "chinaRed"
  | "chinaRedHover"
  | "chinaRedSoft"
  | "foilGold"
  | "foilGoldDark"
  | "foilGoldSoft"
  | "jade"
  | "jadeSoft"
  | "river"
  | "riverSoft"
  | "onPrimary"
  | "shadowSm"
  | "shadowRaised"
  | "primary"
  | "primaryHover"
  | "success"
  | "successSoft"
  | "warning"
  | "warningSoft"
  | "danger"
  | "dangerSoft"
  | "info"
  | "infoSoft"
  | "focus"
  | "fontSans"
  | "fontMono"
  | "textXs"
  | "textSm"
  | "textMd"
  | "textLg"
  | "textXl"
  | "text2xl"
  | "text3xl"
  | "space1"
  | "space2"
  | "space3"
  | "space4"
  | "space5"
  | "space6"
  | "space8"
  | "space10"
  | "space12"
  | "space16"
  | "radiusXs"
  | "radiusSm"
  | "radiusMd"
  | "radiusPill"
  | "motionFast"
  | "motionBase"
  | "motionSlow"
  | "easeStandard";

export const designTokens: Record<DesignTokenName, string> = {
  background: "#fefdf9",
  app: "#f8f6ee",
  surface: "#ffffff",
  surfaceWarm: "#fbfaf5",
  surfaceRed: "#f9e8e5",
  surfaceGold: "#f7ebcb",
  ink: "#211714",
  inkSoft: "#56453e",
  muted: "#74645d",
  faint: "#a0928b",
  line: "#e2d9cb",
  lineStrong: "#cfc5b8",
  chinaRed: "#b92420",
  chinaRedHover: "#a51f24",
  chinaRedSoft: "#f9e8e5",
  foilGold: "#b98522",
  foilGoldDark: "#7a5314",
  foilGoldSoft: "#f7ebcb",
  jade: "#1f7a5a",
  jadeSoft: "#e4f2ec",
  river: "#2f6f8f",
  riverSoft: "#e2edf2",
  onPrimary: "#ffffff",
  shadowSm: "0 1px 2px rgba(33, 23, 20, 0.06)",
  shadowRaised: "0 18px 40px rgba(33, 23, 20, 0.08)",
  primary: "#b92420",
  primaryHover: "#a51f24",
  success: "#1f7a5a",
  successSoft: "#e4f2ec",
  warning: "#7a5314",
  warningSoft: "#f7ebcb",
  danger: "#b92420",
  dangerSoft: "#f9e8e5",
  info: "#2f6f8f",
  infoSoft: "#e2edf2",
  focus: "#b92420",
  fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
  textXs: "12px",
  textSm: "14px",
  textMd: "16px",
  textLg: "18px",
  textXl: "22px",
  text2xl: "28px",
  text3xl: "40px",
  space1: "4px",
  space2: "8px",
  space3: "12px",
  space4: "16px",
  space5: "20px",
  space6: "24px",
  space8: "32px",
  space10: "40px",
  space12: "48px",
  space16: "64px",
  radiusXs: "4px",
  radiusSm: "8px",
  radiusMd: "12px",
  radiusPill: "999px",
  motionFast: "140ms",
  motionBase: "180ms",
  motionSlow: "240ms",
  easeStandard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
};

const cssVariableNames: Record<DesignTokenName, string> = {
  background: "--vp-bg",
  app: "--vp-app",
  surface: "--vp-surface",
  surfaceWarm: "--vp-surface-warm",
  surfaceRed: "--vp-surface-red",
  surfaceGold: "--vp-surface-gold",
  ink: "--vp-ink",
  inkSoft: "--vp-ink-soft",
  muted: "--vp-muted",
  faint: "--vp-faint",
  line: "--vp-line",
  lineStrong: "--vp-line-strong",
  chinaRed: "--vp-china-red",
  chinaRedHover: "--vp-china-red-hover",
  chinaRedSoft: "--vp-china-red-soft",
  foilGold: "--vp-foil-gold",
  foilGoldDark: "--vp-foil-gold-dark",
  foilGoldSoft: "--vp-foil-gold-soft",
  jade: "--vp-jade",
  jadeSoft: "--vp-jade-soft",
  river: "--vp-river",
  riverSoft: "--vp-river-soft",
  onPrimary: "--vp-on-primary",
  shadowSm: "--vp-shadow-sm",
  shadowRaised: "--vp-shadow-raised",
  primary: "--vp-primary",
  primaryHover: "--vp-primary-hover",
  success: "--vp-success",
  successSoft: "--vp-success-soft",
  warning: "--vp-warning",
  warningSoft: "--vp-warning-soft",
  danger: "--vp-danger",
  dangerSoft: "--vp-danger-soft",
  info: "--vp-info",
  infoSoft: "--vp-info-soft",
  focus: "--vp-focus",
  fontSans: "--vp-font-sans",
  fontMono: "--vp-font-mono",
  textXs: "--vp-text-xs",
  textSm: "--vp-text-sm",
  textMd: "--vp-text-md",
  textLg: "--vp-text-lg",
  textXl: "--vp-text-xl",
  text2xl: "--vp-text-2xl",
  text3xl: "--vp-text-3xl",
  space1: "--vp-space-1",
  space2: "--vp-space-2",
  space3: "--vp-space-3",
  space4: "--vp-space-4",
  space5: "--vp-space-5",
  space6: "--vp-space-6",
  space8: "--vp-space-8",
  space10: "--vp-space-10",
  space12: "--vp-space-12",
  space16: "--vp-space-16",
  radiusXs: "--vp-radius-xs",
  radiusSm: "--vp-radius-sm",
  radiusMd: "--vp-radius-md",
  radiusPill: "--vp-radius-pill",
  motionFast: "--vp-motion-fast",
  motionBase: "--vp-motion-base",
  motionSlow: "--vp-motion-slow",
  easeStandard: "--vp-ease-standard",
};

export const designTokenCss = `:root{color-scheme:light;${Object.entries(designTokens)
  .map(([name, value]) => `${cssVariableNames[name as DesignTokenName]}:${value};`)
  .join("")}}`;

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  }

  const redChannel = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const greenChannel = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blueChannel = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const red = redChannel <= 0.04045 ? redChannel / 12.92 : ((redChannel + 0.055) / 1.055) ** 2.4;
  const green =
    greenChannel <= 0.04045 ? greenChannel / 12.92 : ((greenChannel + 0.055) / 1.055) ** 2.4;
  const blue =
    blueChannel <= 0.04045 ? blueChannel / 12.92 : ((blueChannel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
