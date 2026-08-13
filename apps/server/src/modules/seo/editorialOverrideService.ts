import {
  SeoEditorialOverrideMutationSchema,
  SeoEditorialOverrideSchema,
  type SeoEditorialOverride,
} from "@visepanda/domain";

export type SeoEditorialOverrideService = {
  get(input: {
    poiId: string;
    intent: SeoEditorialOverride["intent"];
  }): Promise<SeoEditorialOverride | null>;
  save(input: {
    actorId: string;
    poiId: string;
    intent: SeoEditorialOverride["intent"];
    title: string | null;
    summary: string | null;
    emphasis: string | null;
  }): Promise<SeoEditorialOverride>;
  delete(input: {
    actorId: string;
    poiId: string;
    intent: SeoEditorialOverride["intent"];
  }): Promise<boolean>;
};

/**
 * A durable implementation owns authorization and candidate gating elsewhere. This memory version
 * exists only for local-demo/test composition and preserves the same bounded presentation contract.
 */
export function createInMemorySeoEditorialOverrideService(
  options: { now?: () => Date } = {},
): SeoEditorialOverrideService {
  const now = options.now ?? (() => new Date());
  const entries = new Map<string, SeoEditorialOverride>();

  return {
    async get(input) {
      return entries.get(keyFor(input)) ?? null;
    },
    async save(input) {
      const { actorId: _actorId, ...rawMutation } = input;
      const mutation = SeoEditorialOverrideMutationSchema.parse(rawMutation);
      const override = SeoEditorialOverrideSchema.parse({
        ...mutation,
        updatedAt: now().toISOString(),
      });
      entries.set(keyFor(override), override);
      return override;
    },
    async delete(input) {
      return entries.delete(keyFor(input));
    },
  };
}

function keyFor(input: { poiId: string; intent: string }): string {
  return `${input.poiId}:${input.intent}`;
}
