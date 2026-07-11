import { describe, expect, it } from "vitest";
import { adapterInventory, resolveDatabaseAdapter, resolveRuntimeMode } from "./runtimeMode.js";

describe("resolveRuntimeMode", () => {
  it.each(["preview", "staging", "production"] as const)(
    "resolves the explicit deployed mode %s without allowing memory",
    (mode) => {
      expect(resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: mode })).toEqual({
        ok: true,
        mode,
        deployed: true,
        allowsMemory: false,
        label: null,
      });
    },
  );

  it("labels an explicit local demo and permits its fixture boundary", () => {
    expect(resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "local-demo" })).toEqual({
      ok: true,
      mode: "local-demo",
      deployed: false,
      allowsMemory: true,
      label: "Demo mode",
    });
  });

  it("supports test only when it is selected explicitly", () => {
    expect(resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "test" })).toEqual({
      ok: true,
      mode: "test",
      deployed: false,
      allowsMemory: true,
      label: "Test mode",
    });
  });

  it("fails closed when mode is missing or invalid", () => {
    expect(resolveRuntimeMode({})).toMatchObject({
      ok: false,
      status: "unavailable",
      code: "runtime_mode_missing",
    });
    expect(resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "development" })).toMatchObject({
      ok: false,
      status: "unavailable",
      code: "runtime_mode_invalid",
    });
  });
});

describe("resolveDatabaseAdapter", () => {
  it("preserves an invalid runtime as the root unavailable cause", () => {
    expect(resolveDatabaseAdapter(resolveRuntimeMode({}), {})).toMatchObject({
      status: "unavailable",
      code: "runtime_unavailable",
    });
  });

  it("requires Postgres in every deployed mode", () => {
    const runtime = resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "production" });

    expect(resolveDatabaseAdapter(runtime, {})).toEqual({
      status: "unavailable",
      dependency: "database",
      adapter: null,
      code: "database_url_missing",
      message: "The durable database is not configured for this runtime.",
    });
    expect(resolveDatabaseAdapter(runtime, { DATABASE_URL: "secret-connection-string" })).toEqual({
      status: "ready",
      dependency: "database",
      adapter: "postgres",
      code: null,
      message: null,
    });
  });

  it("uses memory only for an explicit local demo without a database", () => {
    const runtime = resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "local-demo" });

    expect(resolveDatabaseAdapter(runtime, {})).toEqual({
      status: "degraded",
      dependency: "database",
      adapter: "memory-demo",
      code: "demo_memory_selected",
      message: "Demo mode uses non-durable in-memory data.",
    });
  });

  it("requires an explicitly named adapter in test mode", () => {
    const runtime = resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "test" });

    expect(resolveDatabaseAdapter(runtime, {})).toMatchObject({
      status: "unavailable",
      code: "test_adapter_missing",
    });
    expect(resolveDatabaseAdapter(runtime, {}, "memory-test")).toMatchObject({
      status: "ready",
      adapter: "memory-test",
    });
  });

  it("never includes a connection string in diagnostics", () => {
    const secret = "postgresql://secret-user:secret-password@private-host/database";
    const runtime = resolveRuntimeMode({ VISEPANDA_RUNTIME_MODE: "preview" });
    const result = resolveDatabaseAdapter(runtime, { DATABASE_URL: secret });

    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe("adapterInventory", () => {
  it("assigns one production owner and follow-up to every persistent object", () => {
    expect(adapterInventory.map((entry) => entry.object)).toEqual([
      "trip",
      "human-task",
      "outbound-commerce",
      "telemetry",
      "agent-trace",
      "knowledge",
      "ops-authorization",
    ]);
    expect(adapterInventory.every((entry) => entry.productionOwner && entry.canonicalIssue)).toBe(
      true,
    );
  });
});
