// @visepanda/domain — the single source of truth for all domain models.
// Rule: any new feature changes this package FIRST (zod schemas + pure
// functions + unit tests, standalone PR), then web/mobile/server consume it.

export const DOMAIN_VERSION = "0.0.1";

export * from "./copilot/index.js";
export * from "./errors/index.js";
export * from "./events/index.js";
export * from "./trip/index.js";
