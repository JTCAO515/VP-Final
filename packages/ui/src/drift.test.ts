import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const surfaceStyles = ["apps/web/src/app/styles.css", "apps/ops/src/app/styles.css"];
const retiredCoreValues = [
  "#fefdf9",
  "#f8f6ee",
  "#ffffff",
  "#fbfaf5",
  "#f9e8e5",
  "#211714",
  "#56453e",
  "#74645d",
  "#e2d9cb",
  "#b92420",
  "#a51f24",
  "#b98522",
  "#7a5314",
  "#f7ebcb",
  "#1f7a5a",
  "#e4f2ec",
  "#2f6f8f",
  "#e2edf2",
];

it("does not duplicate canonical core colors in Web or Ops styles", () => {
  for (const stylePath of surfaceStyles) {
    const stylesheet = readFileSync(resolve(repositoryRoot, stylePath), "utf8").toLowerCase();
    for (const retiredValue of retiredCoreValues) {
      expect(
        stylesheet,
        `${stylePath} must consume --vp-* instead of ${retiredValue}`,
      ).not.toContain(retiredValue);
    }
  }
});
