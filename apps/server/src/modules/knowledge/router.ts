import { PoiCategorySchema } from "@visepanda/domain";
import { z } from "zod";
import { publicProcedure, router } from "../../trpc.js";
import { createInMemoryKnowledgeService } from "./service.js";

const ListPoisInputSchema = z
  .object({
    city: z.string().min(1).optional(),
    category: PoiCategorySchema.optional(),
  })
  .optional();

const UpdateFactInputSchema = z.object({
  factId: z.string().min(1),
  value: z.record(z.unknown()),
});

export const knowledgeRouter = router({
  listPois: publicProcedure.input(ListPoisInputSchema).query(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).listPois(toPoiFilter(input));
  }),
  updateFact: publicProcedure.input(UpdateFactInputSchema).mutation(({ ctx, input }) => {
    return (ctx.knowledgeService ?? createInMemoryKnowledgeService()).updateFact(input);
  }),
});

function toPoiFilter(input: z.infer<typeof ListPoisInputSchema>) {
  const filter: { city?: string; category?: z.infer<typeof PoiCategorySchema> } = {};
  if (input?.city) filter.city = input.city;
  if (input?.category) filter.category = input.category;
  return filter;
}
