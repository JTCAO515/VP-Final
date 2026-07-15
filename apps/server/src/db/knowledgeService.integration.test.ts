import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbKnowledgeService } from "./knowledgeService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const poiId = "30000000-0000-0000-0000-000000000001";

describeDatabase("database KnowledgeService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbKnowledgeService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`
      insert into public.pois (id, city, category, name_en, source_ids)
      values (${poiId}, 'Integration City', 'attraction', 'Integration POI', '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.pois where id = ${poiId}`;
    await sql.end();
  });

  it("persists a draft and exposes it only after explicit review", async () => {
    const created = await service.createFact({
      poiId,
      factType: "metro_access",
      value: { label: "Near metro" },
      confidence: 0.9,
      source: "https://example.com/integration-source",
    });

    expect(created.status).toBe("draft");
    await expect(service.listPois({ city: "Integration City" })).resolves.toMatchObject([
      { id: poiId, facts: [] },
    ]);

    const reviewed = await service.renewFact({ factId: created.id });
    expect(reviewed).toMatchObject({ id: created.id, status: "reviewed" });
    await expect(service.listPois({ city: "Integration City" })).resolves.toMatchObject([
      { id: poiId, facts: [{ id: created.id, status: "reviewed" }] },
    ]);
  });
});
