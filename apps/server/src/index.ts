// @visepanda/app-server — placeholder entry. The real scaffold lands with its
// first feature issue (see docs/planning baseline §8 issue list); until then
// this only proves the workspace graph builds end to end.
import { DOMAIN_VERSION } from "@visepanda/domain";

export const APP = "server";
export const domainVersion = DOMAIN_VERSION;

export { appRouter } from "./router.js";
export type { AppRouter } from "./router.js";
export { createDb } from "./db/client.js";
export { createDbTripService } from "./db/tripService.js";
export { createInMemoryTripService } from "./modules/trip/service.js";
export type { TripOwner, TripService } from "./modules/trip/service.js";
