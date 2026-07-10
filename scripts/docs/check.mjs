import fs from "node:fs";
import path from "node:path";

import {
  collectControlledMarkdown,
  extractLocalLinks,
  handoffPath,
  indexPath,
  readHandoff,
  readManifest,
  renderIndex,
  repoRoot,
} from "./lib.mjs";

const manifest = readManifest();
const handoff = readHandoff();
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
if (handoff.schemaVersion !== 1) errors.push("handoff schemaVersion must be 1");

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

for (const key of [
  "updatedAt",
  "updatedBy",
  "baseBranch",
  "lastVerifiedCommit",
  "currentPhase",
  "maturity",
  "lastCompleted",
]) {
  if (typeof handoff[key] !== "string" || handoff[key].trim() === "") {
    errors.push(`docs/handoff.json: missing ${key}`);
  }
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(handoff.updatedAt ?? "")) {
  errors.push("docs/handoff.json: updatedAt must use YYYY-MM-DD");
}

for (const key of ["activeWork", "nextActions", "blockers", "verification", "readingOrder"]) {
  if (!Array.isArray(handoff[key]) || handoff[key].length === 0) {
    errors.push(`docs/handoff.json: ${key} must be a non-empty array`);
  }
}

for (const [index, work] of (handoff.activeWork ?? []).entries()) {
  for (const key of ["ref", "title", "state", "owner", "next"]) {
    if (typeof work[key] !== "string" || work[key].trim() === "") {
      errors.push(`docs/handoff.json: activeWork[${index}] missing ${key}`);
    }
  }
}

for (const [index, action] of (handoff.nextActions ?? []).entries()) {
  for (const key of ["priority", "action", "exitCriteria"]) {
    if (typeof action[key] !== "string" || action[key].trim() === "") {
      errors.push(`docs/handoff.json: nextActions[${index}] missing ${key}`);
    }
  }
}

for (const [index, item] of (handoff.readingOrder ?? []).entries()) {
  if (!registered.has(item.path)) {
    errors.push(`docs/handoff.json: readingOrder[${index}] is not registered: ${item.path}`);
  }
  if (typeof item.reason !== "string" || item.reason.trim() === "") {
    errors.push(`docs/handoff.json: readingOrder[${index}] missing reason`);
  }
}

if (manifest.impact.handoffPath !== path.relative(repoRoot, handoffPath)) {
  errors.push("manifest impact.handoffPath must point to docs/handoff.json");
}

const expectedIndex = renderIndex(manifest, handoff);
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
