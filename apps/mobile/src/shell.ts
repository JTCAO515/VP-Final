export const MOBILE_TABS = ["today", "tools", "help", "me"] as const;

export type MobileTab = (typeof MOBILE_TABS)[number];

export const MOBILE_TAB_LABELS: Readonly<Record<MobileTab, string>> = {
  today: "Today",
  tools: "Tools",
  help: "Help",
  me: "Me",
};

export function isMobileTab(value: string): value is MobileTab {
  return MOBILE_TABS.includes(value as MobileTab);
}
