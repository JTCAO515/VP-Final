import { describe, expect, it } from "vitest";
import { createInMemoryOpsAuthorizationService } from "@visepanda/app-server/ops-authorization";
import { authorizeOpsRequest, isAuthorizedOpsRequest } from "./opsAccess";

const editorId = "11111111-1111-4111-8111-111111111111";

describe("Ops request authorization", () => {
  const service = createInMemoryOpsAuthorizationService([{ userId: editorId, role: "editor" }]);
  const request = new Request("https://ops.example.test/api/knowledge/pois");

  it("returns 401 without a verified user", async () => {
    const result = await authorizeOpsRequest(request, "knowledge.read", {
      getUser: () => Promise.resolve(null),
      authorizationService: service,
    });
    expect(isAuthorizedOpsRequest(result)).toBe(false);
    if (!isAuthorizedOpsRequest(result)) expect(result.status).toBe(401);
  });

  it("returns 403 when a verified user lacks the requested permission", async () => {
    const result = await authorizeOpsRequest(request, "task.contact.read", {
      getUser: () => Promise.resolve({ id: editorId }),
      authorizationService: service,
    });
    expect(isAuthorizedOpsRequest(result)).toBe(false);
    if (!isAuthorizedOpsRequest(result)) expect(result.status).toBe(403);
  });

  it("ignores a forged client role for a verified traveler without membership", async () => {
    const forgedRequest = new Request("https://ops.example.test/api/roles", {
      headers: { "x-ops-role": "admin" },
    });
    const result = await authorizeOpsRequest(forgedRequest, "membership.write", {
      getUser: () => Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }),
      authorizationService: service,
    });
    expect(isAuthorizedOpsRequest(result)).toBe(false);
    if (!isAuthorizedOpsRequest(result)) expect(result.status).toBe(403);
  });

  it("returns trusted access when membership grants the permission", async () => {
    const result = await authorizeOpsRequest(request, "knowledge.write", {
      getUser: () => Promise.resolve({ id: editorId }),
      authorizationService: service,
    });
    expect(isAuthorizedOpsRequest(result)).toBe(true);
    if (isAuthorizedOpsRequest(result)) expect(result.access.role).toBe("editor");
  });
});
