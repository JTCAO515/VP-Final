import { execFileSync } from "node:child_process";

import { matchesPrefix, readManifest } from "./lib.mjs";

const manifest = readManifest();
const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";

if (!base) {
  console.error("Usage: pnpm docs:impact -- --base <git-ref>");
  process.exit(1);
}

function git(args, allowFailure = false) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

const changed = new Set(
  [
    git(["diff", "--name-only", `${base}...HEAD`]),
    git(["diff", "--name-only"]),
    git(["diff", "--name-only", "--cached"]),
    git(["ls-files", "--others", "--exclude-standard"], true),
  ]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);

const changedDocs = new Set(
  [...changed].filter((file) => file.endsWith(".md") && file !== "docs/INDEX.md"),
);
const changedSources = [...changed].filter(
  (file) =>
    file !== "docs/INDEX.md" &&
    manifest.impact.sourcePrefixes.some((prefix) => matchesPrefix(file, prefix)),
);

const failures = [];

for (const source of changedSources) {
  const mapped = manifest.documents.filter((document) =>
    document.sourcePrefixes.some((prefix) => matchesPrefix(source, prefix)),
  );
  if (mapped.length === 0) {
    failures.push(`${source}: no registered document mapping`);
    continue;
  }

  if (!mapped.some((document) => changedDocs.has(document.path))) {
    failures.push(
      `${source}: update one mapped document (${mapped.map((document) => document.path).join(", ")})`,
    );
  }
}

if (failures.length > 0) {
  console.error(`Documentation impact check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Documentation impact check passed: ${changedSources.length} source/config changes and ${changedDocs.size} documentation changes.`,
);
