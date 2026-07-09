import { KnowledgeGapSchema, PoiCategorySchema } from "@visepanda/domain";
import { z } from "zod";
import { publicProcedure, router } from "../../trpc.js";
import { createInMemoryKnowledgeService } from "./service.js";

const ListPoisInputSchema = z
  .object({
    city: z.string().min(1).optional(),
    category: PoiCategorySchema.optional(),
    includeExpired: z.boolean().optional(),
    includeDeprecated: z.boolean().optional(),
  })
  .optional();

const CreateFactInputSchema = z.object({
  poiId: z.string().min(1),
  factType: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

const UpdateFactInputSchema = z.object({
  factId: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const FactIdInputSchema = z.object({
  factId: z.string().min(1),
});

const RenewFactInputSchema = FactIdInputSchema.extend({
  expiresAt: z.string().datetime().nullable().optional(),
});

const RecordGapInputSchema = z.object({
  question: z.string().min(1),
  city: z.string().min(1).optional(),
});

const ListGapsInputSchema = z
  .object({
    status: KnowledgeGapSchema.shape.status.optional(),
  })
  .optional();

const UpdateGapInputSchema = z.object({
  gapId: z.string().min(1),
  status: KnowledgeGapSchema.shape.status,
  resolutionTarget: z
    .object({
      kind: z.enum(["poi_fact", "guide"]),
      id: z.string().min(1),
    })
    .optional(),
});

export const knowledgeRouter = router({
  listPois: publicProcedure.input(ListPoisInputSchema).query(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).listPois(toPoiFilter(input));
  }),
  createFact: publicProcedure.input(CreateFactInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).createFact({
      poiId: input.poiId,
      factType: input.factType,
      value: input.value,
      confidence: input.confidence,
      source: input.source,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    });
  }),
  updateFact: publicProcedure.input(UpdateFactInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).updateFact({
      factId: input.factId,
      value: input.value,
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    });
  }),
  listExpiredFacts: publicProcedure.query(({ ctx }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).listExpiredFacts();
  }),
  renewFact: publicProcedure.input(RenewFactInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).renewFact({
      factId: input.factId,
      expiresAt: input.expiresAt ?? null,
    });
  }),
  deprecateFact: publicProcedure.input(FactIdInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).deprecateFact(input);
  }),
  recordGap: publicProcedure.input(RecordGapInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).recordGap({
      question: input.question,
      ...(input.city ? { city: input.city } : {}),
    });
  }),
  listGaps: publicProcedure.input(ListGapsInputSchema).query(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).listGaps(
      input?.status ? { status: input.status } : {},
    );
  }),
  updateGap: publicProcedure.input(UpdateGapInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).updateGap({
      gapId: input.gapId,
      status: input.status,
      ...(input.resolutionTarget ? { resolutionTarget: input.resolutionTarget } : {}),
    });
  }),
});

function toPoiFilter(input: z.infer<typeof ListPoisInputSchema>) {
  const filter: {
    city?: string;
    category?: z.infer<typeof PoiCategorySchema>;
    includeExpired?: boolean;
    includeDeprecated?: boolean;
  } = {};
  if (input?.city) filter.city = input.city;
  if (input?.category) filter.category = input.category;
  if (input?.includeExpired) filter.includeExpired = input.includeExpired;
  if (input?.includeDeprecated) filter.includeDeprecated = input.includeDeprecated;
  return filter;
}
