import {
  CopilotEnvelopeSchema,
  resolveEligibleSafePhrase,
  type CopilotEnvelope,
  type CopilotIntent,
  type SafePhrase,
  type SafePhraseCategory,
  type SafePhraseSelection,
} from "@visepanda/domain";

export type ExecutionFactSupport = {
  id: string;
  supportingValues: readonly string[];
};

export type SafePhraseResolver = (
  selection: SafePhraseSelection,
) => Promise<SafePhrase | null> | SafePhrase | null;

export class ExecutionFactSupportError extends Error {
  readonly code = "EXECUTION_FACT_UNSUPPORTED";

  constructor(readonly claims: readonly string[]) {
    super("No answer was generated or invented.");
    this.name = "ExecutionFactSupportError";
  }
}

const HIGH_RISK_REQUESTS: ReadonlyArray<{
  category: SafePhraseCategory;
  pattern: RegExp;
}> = [
  {
    category: "emergency_help",
    pattern: /\b(?:emergency|ambulance|police|fire|danger)\b|紧急|报警|救护/i,
  },
  {
    category: "symptoms_medical",
    pattern:
      /\b(?:symptom|medical|doctor|hospital|medicine|pain|sick)\b|症状|医生|医院|就医|疼痛|生病/i,
  },
  {
    category: "allergy_dietary",
    pattern: /\b(?:allerg(?:y|ic)|peanut|gluten|vegetarian|vegan|dietary)\b|过敏|花生|麸质|素食/i,
  },
  {
    category: "passport_visa_ticket",
    pattern:
      /\b(?:passport|visa|boarding\s+(?:pass|ticket))\b|\b(?:show|translate|write|say|state|card|help\s+with)\b[^\n]{0,80}\b(?:ticket|boarding)\b|(?:护照|签证|票务|车票|机票)[^\n]{0,40}(?:说明|出示|翻译|怎么说)/i,
  },
  {
    category: "destination_address",
    pattern: /\baddress\b|\b(?:take|bring|drive)\s+me\s+to\b|地址|带我去|送我去/i,
  },
];

const HIGH_RISK_FALLBACKS: Readonly<Record<SafePhraseCategory, string>> = {
  allergy_dietary:
    "I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.",
  symptoms_medical:
    "I can’t safely create a medical translation for this request. Please contact a qualified clinician or pharmacist; for urgent danger, contact local emergency services.",
  emergency_help:
    "I can’t create an emergency request card for this situation. Contact local emergency services, your accommodation, insurer, or consulate as appropriate.",
  passport_visa_ticket:
    "I can’t verify or create this document statement. Check with the issuing authority, carrier, venue, or its staff.",
  destination_address:
    "I can’t safely provide a destination address. Use an official venue, map, or booking confirmation, or ask the venue to verify the address.",
};

const EXECUTION_FACT_PATTERNS = [
  /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g,
  /(?:¥|\$)\s?\d+(?:[.,]\d{1,2})?|\b(?:CNY|RMB|USD)\s?\d+(?:[.,]\d{1,2})?\b/gi,
  /\b(?:metro|subway|bus|train)\s+(?:line\s+)?[a-z]?\d+[a-z]?\b|\bline\s+[a-z]?\d+[a-z]?\b/gi,
  /\b\d{1,5}\s+[a-z][a-z .'-]{1,80}\b(?:road|street|avenue|lane|building|no\.?)(?=\b|,|$)/gi,
  /(?:address|地址)\s*[:：]\s*[^\n.,;]{1,120}/gi,
] as const;

export function classifyHighRiskRequest(message: string): SafePhraseCategory | null {
  return HIGH_RISK_REQUESTS.find(({ pattern }) => pattern.test(message))?.category ?? null;
}

export async function resolveHighRiskEnvelope(input: {
  category: SafePhraseCategory;
  intent: CopilotIntent;
  selection?: SafePhraseSelection;
  resolveSafePhrase: SafePhraseResolver;
  now?: Date;
  includeHumanHelp: boolean;
}): Promise<CopilotEnvelope> {
  const phrase = input.selection ? await input.resolveSafePhrase(input.selection) : null;
  const eligiblePhrase =
    phrase !== null &&
    input.selection !== undefined &&
    phrase.category === input.category &&
    resolveEligibleSafePhrase([phrase], input.selection, input.now) === phrase
      ? phrase
      : null;

  if (eligiblePhrase) {
    return CopilotEnvelopeSchema.parse({
      intent: input.intent,
      message: {
        headline: "Verified fixed expression",
        body: eligiblePhrase.chineseExpression,
        highlights: [eligiblePhrase.englishIntent],
      },
      tripActions: [],
      toolCards: [],
      commercialActions: [],
      humanHelp: null,
      citations: [],
    });
  }

  return CopilotEnvelopeSchema.parse({
    intent: input.intent,
    message: {
      headline: "Verified expression unavailable",
      body: HIGH_RISK_FALLBACKS[input.category],
      highlights: [],
    },
    tripActions: [],
    toolCards: [],
    commercialActions: [],
    humanHelp:
      input.includeHumanHelp && input.category !== "emergency_help"
        ? {
            kind: "task",
            prefill: `Need an operator-verified fixed expression for ${input.category}.`,
          }
        : null,
    citations: [],
  });
}

export function validateExecutionFactSupport(
  envelope: CopilotEnvelope,
  facts: readonly ExecutionFactSupport[] = [],
): CopilotEnvelope {
  const citedFactIds = new Set(envelope.citations.map((citation) => citation.fact_id));
  const supportedValues = facts
    .filter((fact) => citedFactIds.has(fact.id))
    .flatMap((fact) => fact.supportingValues)
    .map(normalizeForComparison)
    .filter(Boolean);
  const claims = extractExecutionFactClaims(collectEnvelopeText(envelope));
  const unsupported = claims.filter(
    (claim) => !supportedValues.some((value) => value.includes(normalizeForComparison(claim))),
  );

  if (unsupported.length > 0) throw new ExecutionFactSupportError(unsupported);
  return envelope;
}

function extractExecutionFactClaims(value: string): string[] {
  const claims = new Set<string>();
  for (const pattern of EXECUTION_FACT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      const claim = match[0]?.trim();
      if (claim) claims.add(claim);
    }
  }
  return [...claims];
}

function collectEnvelopeText(envelope: CopilotEnvelope): string {
  const values: string[] = [];
  collectStringLeaves(envelope.message, values);
  collectStringLeaves(envelope.tripActions, values);
  collectStringLeaves(envelope.toolCards, values);
  collectStringLeaves(envelope.commercialActions, values);
  collectStringLeaves(envelope.humanHelp, values);
  return values.join("\n");
}

function collectStringLeaves(value: unknown, values: string[]): void {
  if (typeof value === "string") {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringLeaves(item, values));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringLeaves(item, values));
  }
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}
