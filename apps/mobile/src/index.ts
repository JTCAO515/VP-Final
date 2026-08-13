import { DOMAIN_VERSION } from "@visepanda/domain";
import { nativeDesignTokens } from "@visepanda/ui";

export const APP = "mobile";
export const domainVersion = DOMAIN_VERSION;

// The Expo shell consumes this shared projection rather than maintaining native-only colors.
export const mobileTheme = nativeDesignTokens;
