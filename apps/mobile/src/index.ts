// @visepanda/app-mobile — placeholder entry. The real scaffold lands with its
// first feature issue (see docs/planning baseline §8 issue list); until then
// this only proves the workspace graph builds end to end.
import { DOMAIN_VERSION } from "@visepanda/domain";
import { nativeDesignTokens } from "@visepanda/ui";

export const APP = "mobile";
export const domainVersion = DOMAIN_VERSION;

// The future Expo shell consumes this shared projection rather than maintaining native-only colors.
export const mobileTheme = nativeDesignTokens;
