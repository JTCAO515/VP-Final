import {
  KnowledgeGapSchema,
  PoiCategorySchema,
  PoiFactEvidenceSummarySchema,
  PoiFactSourceClassSchema,
  PoiFactSourceLocatorSchema,
} from "@visepanda/domain";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";

const ListPoisInputSchema = z
  .object({
    city: z.string().min(1).optional(),
    category: PoiCategorySchema.optional(),
    includeExpired: z.boolean().optional(),
    includeDeprecated: z.boolean().optional(),
    includeDrafts: z.boolean().optional(),
  })
  .optional();

const CreateFactInputSchema = z.object({
  poiId: z.string().min(1),
  factType: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  sourceClass: PoiFactSourceClassSchema,
  sourceLocator: PoiFactSourceLocatorSchema,
  evidenceSummary: PoiFactEvidenceSummarySchema,
  expiresAt: z.string().datetime().nullable().optional(),
});

const UpdateFactInputSchema = z.object({
  factId: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
  sourceClass: PoiFactSourceClassSchema.optional(),
  sourceLocator: PoiFactSourceLocatorSchema.optional(),
  evidenceSummary: PoiFactEvidenceSummarySchema.optional(),
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
    return requireService(ctx.knowledgeService, "Knowledge").listPois(toPoiFilter(input));
  }),
  createFact: publicProcedure.input(CreateFactInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").createFact({
      poiId: input.poiId,
      factType: input.factType,
      value: input.value,
      confidence: input.confidence,
      sourceClass: input.sourceClass,
      sourceLocator: input.sourceLocator,
      evidenceSummary: input.evidenceSummary,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    });
  }),
  updateFact: publicProcedure.input(UpdateFactInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").updateFact({
      factId: input.factId,
      value: input.value,
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.sourceClass !== undefined ? { sourceClass: input.sourceClass } : {}),
      ...(input.sourceLocator !== undefined ? { sourceLocator: input.sourceLocator } : {}),
      ...(input.evidenceSummary !== undefined ? { evidenceSummary: input.evidenceSummary } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    });
  }),
  listExpiredFacts: publicProcedure.query(({ ctx }) => {
    return requireService(ctx.knowledgeService, "Knowledge").listExpiredFacts();
  }),
  renewFact: publicProcedure.input(RenewFactInputSchema).mutation(() => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "POI facts can only be reviewed through the authenticated Ops endpoint.",
    });
  }),
  deprecateFact: publicProcedure.input(FactIdInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").deprecateFact(input);
  }),
  recordGap: publicProcedure.input(RecordGapInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").recordGap({
      question: input.question,
      ...(input.city ? { city: input.city } : {}),
    });
  }),
  listGaps: publicProcedure.input(ListGapsInputSchema).query(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").listGaps(
      input?.status ? { status: input.status } : {},
    );
  }),
  updateGap: publicProcedure.input(UpdateGapInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.knowledgeService, "Knowledge").updateGap({
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
    includeDrafts?: boolean;
  } = {};
  if (input?.city) filter.city = input.city;
  if (input?.category) filter.category = input.category;
  if (input?.includeExpired) filter.includeExpired = input.includeExpired;
  if (input?.includeDeprecated) filter.includeDeprecated = input.includeDeprecated;
  if (input?.includeDrafts) filter.includeDrafts = input.includeDrafts;
  return filter;
}
