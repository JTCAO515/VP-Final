import type { TripService } from "./modules/trip/service.js";

export type ServerContext = {
  tripService: TripService;
};
