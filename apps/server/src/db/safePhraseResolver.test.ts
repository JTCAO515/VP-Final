import type { SafePhraseSelection } from "@visepanda/domain";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "./client.js";
import { createDbSafePhraseResolver } from "./safePhraseResolver.js";

const selection: SafePhraseSelection = {
  category: "allergy_dietary",
  scene: "restaurant",
  intentKey: "peanut-allergy",
  variantKey: "plain",
  severity: "severe",
};

const reviewedRow = {
  id: "8ad64607-dc57-4d5b-8dfb-3d2813aac985",
  ...selection,
  chineseExpression: "我对花生严重过敏。",
  englishIntent: "I have a severe peanut allergy.",
  sourceClass: "operator_verified",
  sourceLocator: "ops://safe-phrase/peanut-allergy",
  evidenceSummary: "Reviewed by a qualified operator.",
  verifiedBy: "a75ea05d-0146-4ba5-ae21-7374c623967a",
  verifiedAt: new Date("2026-08-10T00:00:00.000Z"),
  expiresAt: new Date("2026-09-01T00:00:00.000Z"),
  reviewPolicy: "operator-verified-90d-v1",
  status: "reviewed",
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
};

function fakeDb(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } as unknown as Db, select, from, where, limit };
}

describe("createDbSafePhraseResolver", () => {
  it("performs one exact reviewed-row lookup and returns a typed phrase", async () => {
    const database = fakeDb([reviewedRow]);
    const resolve = createDbSafePhraseResolver(database.db);

    await expect(resolve(selection)).resolves.toMatchObject({
      ...selection,
      chineseExpression: "我对花生严重过敏。",
      verifiedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(database.select).toHaveBeenCalledTimes(1);
    expect(database.from).toHaveBeenCalledTimes(1);
    expect(database.where).toHaveBeenCalledTimes(1);
    expect(database.limit).toHaveBeenCalledWith(1);
  });

  it("returns unavailable when there is no exact reviewed-row match", async () => {
    const database = fakeDb([]);
    await expect(createDbSafePhraseResolver(database.db)(selection)).resolves.toBeNull();
  });
});
