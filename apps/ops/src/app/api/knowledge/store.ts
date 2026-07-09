import {
  createDb,
  createDbKnowledgeService,
  createInMemoryKnowledgeService,
  type KnowledgeService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsKnowledgeService?: KnowledgeService;
};

export function getKnowledgeService(): KnowledgeService {
  if (process.env.DATABASE_URL) {
    return createDbKnowledgeService(createDb(process.env.DATABASE_URL));
  }

  store.__visepandaOpsKnowledgeService ??= createInMemoryKnowledgeService();
  return store.__visepandaOpsKnowledgeService;
}
