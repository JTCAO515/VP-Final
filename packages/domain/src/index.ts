// @visepanda/domain — the single source of truth for all domain models.
// Rule: any new feature changes this package FIRST (zod schemas + pure
// functions + unit tests, standalone PR), then web/mobile/server consume it.

export const DOMAIN_VERSION = "0.0.1";

export * from "./trip/index.js";
