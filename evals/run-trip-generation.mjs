import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(root, "trip_generation", "golden.json");
const allowedIntents = new Set([
  "chat_only",
  "trip_create",
  "trip_edit",
  "question",
  "commerce_intent",
  "human_help",
]);
const allowedRiskLevels = new Set(["low", "medium", "high"]);

const golden = readJson(goldenPath);
const cases = validateGolden(golden);

if (process.env.EVAL_CANDIDATE_PATH) {
  const candidatePath = resolve(process.env.EVAL_CANDIDATE_PATH);
  const candidates = readJson(candidatePath);
  const score = scoreCandidates(cases, candidates);
  console.log(
    `trip_generation evals: ${score.passed}/${score.total} passed from ${candidatePath}`,
  );

  if (score.passed !== score.total) {
    for (const failure of score.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
} else {
  console.log(`trip_generation golden set valid: ${cases.length} cases`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateGolden(value) {
  assert(value.suite === "trip_generation", "golden suite must be trip_generation");
  assert(value.version === 1, "golden version must be 1");
  assert(Array.isArray(value.cases), "golden cases must be an array");

  const seen = new Set();
  for (const testCase of value.cases) {
    assertString(testCase.id, "case id");
    assert(!seen.has(testCase.id), `duplicate case id: ${testCase.id}`);
    seen.add(testCase.id);

    assertString(testCase.prompt, `${testCase.id} prompt`);
    assert(allowedIntents.has(testCase.expectedIntent), `${testCase.id} intent is invalid`);
    assert(Array.isArray(testCase.requiredPatchOps), `${testCase.id} requiredPatchOps must be an array`);
    assert(Array.isArray(testCase.mustMention), `${testCase.id} mustMention must be an array`);
    assert(allowedRiskLevels.has(testCase.risk), `${testCase.id} risk is invalid`);
  }

  return value.cases;
}

function scoreCandidates(casesToScore, candidateFile) {
  assert(candidateFile.suite === "trip_generation", "candidate suite must be trip_generation");
  assert(Array.isArray(candidateFile.results), "candidate results must be an array");

  const resultsByCase = new Map(candidateFile.results.map((result) => [result.caseId, result]));
  const failures = [];

  for (const testCase of casesToScore) {
    const result = resultsByCase.get(testCase.id);
    if (!result) {
      failures.push(`${testCase.id}: missing candidate result`);
      continue;
    }

    if (result.intent !== testCase.expectedIntent) {
      failures.push(`${testCase.id}: expected intent ${testCase.expectedIntent}, got ${result.intent}`);
    }

    for (const op of testCase.requiredPatchOps) {
      if (!Array.isArray(result.patchOps) || !result.patchOps.includes(op)) {
        failures.push(`${testCase.id}: missing required patch op ${op}`);
      }
    }

    const message = String(result.message ?? "").toLowerCase();
    for (const phrase of testCase.mustMention) {
      if (!message.includes(String(phrase).toLowerCase())) {
        failures.push(`${testCase.id}: message does not mention ${phrase}`);
      }
    }
  }

  return {
    passed: casesToScore.length - new Set(failures.map((failure) => failure.split(":")[0])).size,
    total: casesToScore.length,
    failures,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
}
