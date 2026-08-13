import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  VisePodBindingMutationResponseSchema,
  VisePodDeviceBindingReadResponseSchema,
  VisePodStudioExactUserLookupResponseSchema,
  VisePodStudioProvisioningTokenIssueResponseSchema,
} from "./studio.js";

const openApiPath = fileURLToPath(
  new URL("../../../../docs/visepod/studio-openapi-v1.json", import.meta.url),
);
const fixturesPath = fileURLToPath(
  new URL("../../../../docs/visepod/fixtures/studio-binding-v1.json", import.meta.url),
);
const openApi = JSON.parse(readFileSync(openApiPath, "utf8")) as Record<string, unknown>;
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as {
  contractVersion: string;
  fixturesAreSynthetic: boolean;
  responses: Record<string, unknown>;
};

describe("VisePod Studio published contract artifacts", () => {
  it("pins the four endpoint operations and seven business response fixtures", () => {
    const paths = openApi.paths as Record<string, Record<string, unknown>>;
    expect(openApi.openapi).toBe("3.1.0");
    expect((openApi.info as { version: string }).version).toBe("1.0.0");
    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        "/api/ops/visepod/provisioning-token",
        "/api/ops/visepod/users/resolve",
        "/api/ops/visepod/devices/{deviceId}/binding",
      ]),
    );
    expect(Object.keys(paths["/api/ops/visepod/provisioning-token"]!)).toEqual(["post"]);
    expect(Object.keys(paths["/api/ops/visepod/users/resolve"]!)).toEqual(["post"]);
    expect(Object.keys(paths["/api/ops/visepod/devices/{deviceId}/binding"]!).sort()).toEqual([
      "delete",
      "get",
      "put",
    ]);
    expect(Object.keys(fixtures.responses).sort()).toEqual([
      "activeBindingRead",
      "bindingCreated",
      "bindingRebound",
      "bindingRevoked",
      "exactUserLookup",
      "provisioningTokenIssued",
      "unboundBindingRead",
    ]);
  });

  it("keeps every published business response compatible with its frozen Zod schema", () => {
    const token = fixtures.responses.provisioningTokenIssued as { ok: true } & Record<
      string,
      unknown
    >;
    expect(token.ok).toBe(true);
    const { ok: _ok, ...issued } = token;
    expect(VisePodStudioProvisioningTokenIssueResponseSchema.parse(issued)).toEqual(issued);
    for (const name of ["exactUserLookup"] as const) {
      expect(VisePodStudioExactUserLookupResponseSchema.parse(fixtures.responses[name])).toEqual(
        fixtures.responses[name],
      );
    }
    for (const name of ["unboundBindingRead", "activeBindingRead"] as const) {
      expect(VisePodDeviceBindingReadResponseSchema.parse(fixtures.responses[name])).toEqual(
        fixtures.responses[name],
      );
    }
    for (const name of ["bindingCreated", "bindingRebound", "bindingRevoked"] as const) {
      expect(VisePodBindingMutationResponseSchema.parse(fixtures.responses[name])).toEqual(
        fixtures.responses[name],
      );
    }
  });

  it("uses only explicitly synthetic identifiers and non-production placeholder domains", () => {
    const serialized = JSON.stringify(fixtures);
    const servers = (openApi.servers as Array<{ url: string }>).map((server) => server.url);
    expect(fixtures.contractVersion).toBe("1.0.0");
    expect(fixtures.fixturesAreSynthetic).toBe(true);
    expect(serialized).toContain("fixture-");
    expect(serialized).toContain("example.invalid");
    expect(serialized).not.toMatch(/@(?!example\.invalid)/);
    expect(serialized).not.toMatch(/(?:sk-|gh[op]_|eyJ|Bearer\s)/i);
    expect(servers).toEqual([
      "https://ops-development.example.invalid",
      "https://ops.example.invalid",
    ]);
  });

  it("keeps OpenAPI examples byte-equivalent to the downloadable fixtures", () => {
    const examples = (openApi.components as { examples: Record<string, { value: unknown }> })
      .examples;
    expect(examples.provisioningTokenIssued!.value).toEqual(
      fixtures.responses.provisioningTokenIssued,
    );
    expect(examples.exactUserLookup!.value).toEqual(fixtures.responses.exactUserLookup);
    expect(examples.unboundBindingRead!.value).toEqual(fixtures.responses.unboundBindingRead);
    expect(examples.activeBindingRead!.value).toEqual(fixtures.responses.activeBindingRead);
    expect(examples.bindingCreated!.value).toEqual(fixtures.responses.bindingCreated);
    expect(examples.bindingRebound!.value).toEqual(fixtures.responses.bindingRebound);
    expect(examples.bindingRevoked!.value).toEqual(fixtures.responses.bindingRevoked);
  });
});
