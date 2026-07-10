import {
  appRouter,
  createDb,
  createDbKnowledgeService,
  createDbTripService,
  createInMemoryKnowledgeService,
  createInMemoryTripService,
  type KnowledgeService,
  type RequestIdentity,
  type TripService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaKnowledgeService?: KnowledgeService;
  __visepandaTripService?: TripService;
};

export function getServerCaller(identity?: RequestIdentity) {
  return appRouter.createCaller({
    ...(identity ? { identity } : {}),
    knowledgeService: getKnowledgeService(),
    tripService: getTripService(),
  });
}

function getKnowledgeService(): KnowledgeService {
  if (process.env.DATABASE_URL) {
    return createDbKnowledgeService(createDb(process.env.DATABASE_URL));
  }

  store.__visepandaKnowledgeService ??= createInMemoryKnowledgeService();
  return store.__visepandaKnowledgeService;
}

function getTripService(): TripService {
  if (process.env.DATABASE_URL) {
    return createDbTripService(createDb(process.env.DATABASE_URL));
  }

  store.__visepandaTripService ??= createInMemoryTripService();
  return store.__visepandaTripService;
}
