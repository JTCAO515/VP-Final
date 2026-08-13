import { z } from "zod";

export const CHINA_READINESS_ASSESSMENT_VERSION = 1 as const;

export const ChinaReadinessQuestionIdSchema = z.enum([
  "payment_method",
  "arrival_network",
  "device_and_apps",
  "passport_booking_name",
  "ticket_identity_requirements",
  "arrival_transport",
  "accommodation_address",
  "emergency_contacts",
  "offline_trip_information",
  "language_support",
]);

export const ChinaReadinessAnswerValueSchema = z.enum(["confirmed", "not_confirmed", "unknown"]);
export const ChinaReadinessItemStatusSchema = z.enum(["ready", "action_required", "unknown"]);
export const ChinaReadinessEvidenceStatusSchema = z.enum(["self_reported", "not_provided"]);
export const ChinaReadinessPersistenceConsentSchema = z.enum([
  "not_requested",
  "granted",
  "declined",
]);

export const ChinaReadinessAnswerSchema = z
  .object({
    questionId: ChinaReadinessQuestionIdSchema,
    value: ChinaReadinessAnswerValueSchema,
  })
  .strict();

export const ChinaReadinessAssessmentSchema = z
  .object({
    version: z.literal(CHINA_READINESS_ASSESSMENT_VERSION),
    answers: z.array(ChinaReadinessAnswerSchema).max(10),
    persistenceConsent: ChinaReadinessPersistenceConsentSchema.default("not_requested"),
  })
  .strict()
  .superRefine((assessment, context) => {
    const questionIds = assessment.answers.map((answer) => answer.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers"],
        message: "Each readiness question can be answered at most once",
      });
    }
  });

export const ChinaReadinessQuestionSchema = z
  .object({
    id: ChinaReadinessQuestionIdSchema,
    category: z.enum([
      "payment",
      "network",
      "apps",
      "booking",
      "transport",
      "arrival",
      "emergency",
      "offline",
      "language",
    ]),
    prompt: z.string().trim().min(1).max(220),
    nextAction: z.string().trim().min(1).max(280),
  })
  .strict();

export const ChinaReadinessResultItemSchema = z
  .object({
    ruleId: z.string().regex(/^china-readiness-v1:[a-z_]+$/),
    questionId: ChinaReadinessQuestionIdSchema,
    status: ChinaReadinessItemStatusSchema,
    observedAnswer: ChinaReadinessAnswerValueSchema,
    nextAction: z.string().trim().min(1).max(280),
    evidenceStatus: ChinaReadinessEvidenceStatusSchema,
  })
  .strict();

export const ChinaReadinessResultSchema = z
  .object({
    version: z.literal(CHINA_READINESS_ASSESSMENT_VERSION),
    items: z.array(ChinaReadinessResultItemSchema).length(10),
    persistenceConsent: ChinaReadinessPersistenceConsentSchema,
  })
  .strict();

export type ChinaReadinessQuestionId = z.infer<typeof ChinaReadinessQuestionIdSchema>;
export type ChinaReadinessAnswerValue = z.infer<typeof ChinaReadinessAnswerValueSchema>;
export type ChinaReadinessAssessment = z.infer<typeof ChinaReadinessAssessmentSchema>;
export type ChinaReadinessQuestion = z.infer<typeof ChinaReadinessQuestionSchema>;
export type ChinaReadinessResultItem = z.infer<typeof ChinaReadinessResultItemSchema>;
export type ChinaReadinessResult = z.infer<typeof ChinaReadinessResultSchema>;

/**
 * User-facing preparation prompts. They are self-reporting prompts, not claims that a service,
 * provider, ticket, or official channel is currently available.
 */
export const CHINA_READINESS_QUESTIONS: readonly ChinaReadinessQuestion[] = [
  {
    id: "payment_method",
    category: "payment",
    prompt: "Have you confirmed a payment method you plan to use in China?",
    nextAction: "Confirm a usable payment method before departure.",
  },
  {
    id: "arrival_network",
    category: "network",
    prompt: "Do you have a network plan for your arrival?",
    nextAction: "Choose and confirm a network plan before you travel.",
  },
  {
    id: "device_and_apps",
    category: "apps",
    prompt: "Have you installed and tested the travel apps you plan to use?",
    nextAction: "Install and test the travel apps you expect to need.",
  },
  {
    id: "passport_booking_name",
    category: "booking",
    prompt: "Does the name on your planned bookings exactly match your passport?",
    nextAction: "Check booking names against your passport before confirming tickets.",
  },
  {
    id: "ticket_identity_requirements",
    category: "booking",
    prompt: "Have you checked identity requirements for tickets you plan to book?",
    nextAction: "Check identity requirements before you rely on a ticket plan.",
  },
  {
    id: "arrival_transport",
    category: "transport",
    prompt: "Do you have a plan for your first journey after arrival?",
    nextAction: "Save a simple arrival transport plan and a fallback option.",
  },
  {
    id: "accommodation_address",
    category: "arrival",
    prompt: "Have you saved your first accommodation address in Chinese?",
    nextAction: "Save a verified accommodation address in Chinese before arrival.",
  },
  {
    id: "emergency_contacts",
    category: "emergency",
    prompt: "Have you saved the official emergency and consular contacts relevant to your trip?",
    nextAction: "Save official emergency and consular contacts relevant to your trip.",
  },
  {
    id: "offline_trip_information",
    category: "offline",
    prompt: "Have you stored essential first-day trip information for offline access?",
    nextAction: "Keep essential first-day trip information available offline.",
  },
  {
    id: "language_support",
    category: "language",
    prompt: "Do you have a way to show key addresses or requests in Chinese?",
    nextAction: "Prepare a way to show key addresses or requests in Chinese.",
  },
];

export function deriveChinaReadinessResult(
  input: z.input<typeof ChinaReadinessAssessmentSchema>,
): ChinaReadinessResult {
  const assessment = ChinaReadinessAssessmentSchema.parse(input);
  const answers = new Map(assessment.answers.map((answer) => [answer.questionId, answer.value]));

  return ChinaReadinessResultSchema.parse({
    version: CHINA_READINESS_ASSESSMENT_VERSION,
    persistenceConsent: assessment.persistenceConsent,
    items: CHINA_READINESS_QUESTIONS.map((question) => {
      const observedAnswer = answers.get(question.id) ?? "unknown";
      return {
        ruleId: `china-readiness-v1:${question.id}`,
        questionId: question.id,
        observedAnswer,
        status: readinessStatus(observedAnswer),
        nextAction: question.nextAction,
        evidenceStatus: observedAnswer === "unknown" ? "not_provided" : "self_reported",
      };
    }),
  });
}

function readinessStatus(
  answer: ChinaReadinessAnswerValue,
): z.infer<typeof ChinaReadinessItemStatusSchema> {
  if (answer === "confirmed") return "ready";
  if (answer === "not_confirmed") return "action_required";
  return "unknown";
}
