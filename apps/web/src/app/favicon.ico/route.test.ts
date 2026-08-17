import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("favicon route", () => {
  it("serves the VisePanda icon as a cacheable image response", async () => {
    const response = GET();

    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("immutable");
    await expect(response.text()).resolves.toContain("<svg");
  });
});
