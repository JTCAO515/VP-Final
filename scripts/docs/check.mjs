import fs from "node:fs";
import path from "node:path";

import {
  collectControlledMarkdown,
  extractLocalLinks,
  indexPath,
  readManifest,
  renderIndex,
  repoRoot,
} from "./lib.mjs";

const manifest = readManifest();
const errors = [];
const allowedTypes = new Set([
  "explanation",
  "constraint",
  "reference",
  "decision",
  "runbook",
  "planning",
  "design",
  "methodology",
]);
const allowedStatuses = new Set(["active", "accepted", "frozen", "draft", "historical"]);
const categoryIds = new Set(manifest.categories.map((category) => category.id));
const registered = new Set();

if (manifest.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");

for (const document of manifest.documents) {
  if (registered.has(document.path)) errors.push(`duplicate registry path: ${document.path}`);
  registered.add(document.path);

  if (!categoryIds.has(document.category)) {
    errors.push(`${document.path}: unknown category ${document.category}`);
  }
  if (!allowedTypes.has(document.type)) {
    errors.push(`${document.path}: invalid type ${document.type}`);
  }
  if (!allowedStatuses.has(document.status)) {
    errors.push(`${document.path}: invalid status ${document.status}`);
  }
  for (const key of ["title", "owner", "summary"]) {
    if (typeof document[key] !== "string" || document[key].trim() === "") {
      errors.push(`${document.path}: missing ${key}`);
    }
  }
  if (!Array.isArray(document.sourcePrefixes)) {
    errors.push(`${document.path}: sourcePrefixes must be an array`);
  }

  const absolute = path.join(repoRoot, document.path);
  if (!fs.existsSync(absolute)) {
    errors.push(`registered document missing: ${document.path}`);
    continue;
  }

  const markdown = fs.readFileSync(absolute, "utf8");
  if (!/^#\s+\S/m.test(markdown)) errors.push(`${document.path}: missing level-one heading`);

  for (const link of extractLocalLinks(markdown)) {
    const resolved = path.resolve(path.dirname(absolute), link);
    if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
      errors.push(`${document.path}: local link escapes repository: ${link}`);
    } else if (!fs.existsSync(resolved)) {
      errors.push(`${document.path}: broken local link: ${link}`);
    }
  }
}

const controlled = new Set(collectControlledMarkdown(manifest));
for (const file of controlled) {
  if (!registered.has(file)) errors.push(`controlled Markdown is not registered: ${file}`);
}
for (const file of registered) {
  if (!controlled.has(file))
    errors.push(`registered Markdown is outside controlled paths: ${file}`);
}

const expectedIndex = renderIndex(manifest);
if (!fs.existsSync(indexPath)) {
  errors.push("docs/INDEX.md is missing; run pnpm docs:index");
} else if (fs.readFileSync(indexPath, "utf8") !== expectedIndex) {
  errors.push("docs/INDEX.md is stale; run pnpm docs:index");
}

if (errors.length > 0) {
  console.error(`Documentation check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Documentation check passed: ${registered.size} registered documents.`);
