import {
  appRouter,
  createDb,
  createDbTripService,
  createInMemoryTripService,
  type TripService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaTripService?: TripService;
};

export function getServerCaller() {
  return appRouter.createCaller({ tripService: getTripService() });
}

function getTripService(): TripService {
  if (process.env.DATABASE_URL) {
    return createDbTripService(createDb(process.env.DATABASE_URL));
  }

  store.__visepandaTripService ??= createInMemoryTripService();
  return store.__visepandaTripService;
}
