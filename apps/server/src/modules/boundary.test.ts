import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const modulesDir = dirname(fileURLToPath(import.meta.url));
const forbiddenImports = ["../db/", "../../db/", "../../../db/", "/db/"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("module boundaries", () => {
  it("keeps feature modules from importing database internals directly", () => {
    const violations = sourceFiles(modulesDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return forbiddenImports
        .filter((forbiddenImport) => source.includes(forbiddenImport))
        .map((forbiddenImport) => `${relative(process.cwd(), file)} imports ${forbiddenImport}`);
    });

    expect(violations).toEqual([]);
  });
});
