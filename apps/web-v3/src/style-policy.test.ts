import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { expect, it } from "vitest";

const sourceRoot = new URL("./", import.meta.url);
const policyTestName = "style-policy.test.ts";

it("keeps V3 component styling inside semantic Tailwind utilities", () => {
  for (const path of sourceFiles(sourceRoot)) {
    const relativePath = relative(new URL("../../", import.meta.url).pathname, path);
    const source = readFileSync(path, "utf8");
    expect(source, `${relativePath} must not use arbitrary-value classes`).not.toMatch(
      /[a-z-]+-\[[^\]]+\]/,
    );
    expect(source, `${relativePath} must not use inline style`).not.toMatch(/\bstyle\s*=/);
    expect(source, `${relativePath} must not render JSX style elements`).not.toMatch(/<style\b/i);
    expect(source, `${relativePath} must not contain local color literals`).not.toMatch(
      /#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch)\(/i,
    );
  }
});

it("uses globals.css only for Tailwind and the canonical token bridge", () => {
  const stylesheet = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
  expect(stylesheet).toContain('@import "tailwindcss"');
  expect(stylesheet).toContain('@import "@visepanda/ui/tokens.css"');
  expect(stylesheet).toContain("@theme inline");
  expect(stylesheet).toContain("--color-brand-gold: var(--vp-foil-gold)");
  expect(stylesheet).toContain("--color-*: initial");
  expect(stylesheet).not.toMatch(/(^|\n)\s*[.#][\w-]+\s*\{/m);
  expect(stylesheet).not.toContain(":root");
});

function sourceFiles(directoryUrl: URL): string[] {
  const directory = directoryUrl.pathname;
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(new URL(`${entry.name}/`, directoryUrl));
    if (entry.name === policyTestName) return [];
    return [".ts", ".tsx", ".css"].includes(extname(entry.name)) ? [path] : [];
  });
}
