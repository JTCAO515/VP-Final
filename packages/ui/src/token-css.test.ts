import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { designTokenCss } from "./index.js";

it("keeps the importable CSS projection identical to the canonical token payload", () => {
  const stylesheet = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  expect(stylesheet).toContain(designTokenCss);
});
