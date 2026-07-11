import {
  appRouter,
  createDb,
  createDbKnowledgeService,
  createDbVersionedTripService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type KnowledgeService,
  type RequestIdentity,
  type VersionedTripService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaKnowledgeService?: KnowledgeService;
  __visepandaTripService?: VersionedTripService;
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

function getTripService(): VersionedTripService {
  if (process.env.DATABASE_URL) {
    return createDbVersionedTripService(createDb(process.env.DATABASE_URL));
  }

  store.__visepandaTripService ??= createVersionedInMemoryTripService();
  return store.__visepandaTripService;
}
