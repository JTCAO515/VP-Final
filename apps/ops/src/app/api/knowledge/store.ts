import { INITIAL_POIS, updatePoiFact, type Poi } from "@visepanda/domain";

const store = globalThis as typeof globalThis & {
  __visepandaOpsPois?: Poi[];
};

export function listPois(): Poi[] {
  store.__visepandaOpsPois ??= INITIAL_POIS;
  return store.__visepandaOpsPois;
}

export function updateFact(factId: string, value: Record<string, unknown>): Poi[] {
  store.__visepandaOpsPois = updatePoiFact(listPois(), factId, value);
  return store.__visepandaOpsPois;
}
