import { describe, expect, it } from "vitest";
import { metadata } from "./page";

describe("unlisted product homepage", () => {
  it("uses page-level noindex metadata without restricting access", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
