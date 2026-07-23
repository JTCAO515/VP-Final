import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(() => ({ kind: "db" })),
  postgres: vi.fn(() => ({ kind: "client" })),
}));

vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));
vi.mock("postgres", () => ({ default: mocks.postgres }));

import { createDb } from "./client.js";

describe("createDb", () => {
  beforeEach(() => {
    mocks.drizzle.mockClear();
    mocks.postgres.mockClear();
  });

  it("disables prepared statements for Supavisor transaction-mode compatibility", () => {
    createDb("postgresql://example.invalid/postgres");

    expect(mocks.postgres).toHaveBeenCalledWith("postgresql://example.invalid/postgres", {
      prepare: false,
    });
  });
});
