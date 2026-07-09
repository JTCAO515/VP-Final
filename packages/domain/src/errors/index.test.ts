import { describe, expect, it } from "vitest";
import { DomainErrorSchema } from "./index.js";

describe("DomainErrorSchema", () => {
  it("rejects unknown error codes", () => {
    expect(() => DomainErrorSchema.parse({ code: "MYSTERY", message: "Nope" })).toThrow();
  });
});
