// @visepanda/domain — the single source of truth for all domain models.
// Rule: any new feature changes this package FIRST (zod schemas + pure
// functions + unit tests, standalone PR), then web/mobile/server consume it.
// Real models (TripState, TripPatch, applyPatch, ...) land with V2 Issue #2.

export const DOMAIN_VERSION = "0.0.1";
