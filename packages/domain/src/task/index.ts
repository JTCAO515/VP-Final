import { z } from "zod";

export const HumanTaskKindSchema = z.enum([
  "call_restaurant",
  "ticket_help",
  "translation_help",
  "transport_help",
  "other",
]);

export const HumanTaskStatusSchema = z.enum([
  "requested",
  "triaged",
  "quoted",
  "payment_pending",
  "paid",
  "fulfilling",
  "done",
  "cancelled",
]);

export const HumanTaskSchema = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  kind: HumanTaskKindSchema,
  description: z.string().min(10),
  contact: z.string().min(3),
  status: HumanTaskStatusSchema.default("requested"),
  price_usd: z.number().nonnegative().nullable().default(null),
  payment_link: z.string().url().nullable().default(null),
  operator_note: z.string().nullable().default(null),
  retention_expires_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const HumanTaskCreateSchema = HumanTaskSchema.pick({
  city: true,
  kind: true,
  description: true,
  contact: true,
});

export const HumanTaskSubmissionSchema = HumanTaskCreateSchema.extend({
  idempotency_key: z.string().uuid(),
});

export const HumanTaskReceiptSchema = HumanTaskSchema.pick({
  id: true,
  status: true,
  created_at: true,
});

export const HumanTaskUpdateSchema = z.object({
  id: z.string().min(1),
  price_usd: z.number().nonnegative().nullable().optional(),
  payment_link: z.string().url().nullable().optional(),
  operator_note: z.string().nullable().optional(),
});

export const HumanTaskTransitionReasonSchema = z.string().trim().min(10).max(500);

export const HumanTaskTransitionSchema = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  from_status: HumanTaskStatusSchema,
  to_status: HumanTaskStatusSchema,
  actor_id: z.string().uuid(),
  reason: HumanTaskTransitionReasonSchema,
  created_at: z.string().datetime(),
});

export const HumanTaskTransitionCommandSchema = z.object({
  to_status: HumanTaskStatusSchema,
  reason: HumanTaskTransitionReasonSchema,
});

export const HUMAN_TASK_TRANSITIONS: Readonly<Record<HumanTaskStatus, readonly HumanTaskStatus[]>> =
  {
    requested: ["triaged", "cancelled"],
    triaged: ["quoted", "cancelled"],
    quoted: ["payment_pending", "cancelled"],
    payment_pending: ["paid", "cancelled"],
    paid: ["fulfilling", "cancelled"],
    fulfilling: ["done", "cancelled"],
    done: [],
    cancelled: [],
  };

export function createHumanTask(
  input: z.infer<typeof HumanTaskCreateSchema>,
  now = new Date(),
): HumanTask {
  const timestamp = now.toISOString();

  return HumanTaskSchema.parse({
    id: `task-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    ...input,
    status: "requested",
    created_at: timestamp,
    updated_at: timestamp,
  });
}

export function updateHumanTask(task: HumanTask, input: Omit<HumanTaskUpdate, "id">): HumanTask {
  return HumanTaskSchema.parse({
    ...task,
    ...input,
    updated_at: new Date().toISOString(),
  });
}

export function canTransitionHumanTask(current: HumanTaskStatus, next: HumanTaskStatus): boolean {
  return HUMAN_TASK_TRANSITIONS[current].includes(next);
}

export function transitionHumanTask(
  task: HumanTask,
  next: HumanTaskStatus,
  now = new Date(),
): HumanTask {
  if (!canTransitionHumanTask(task.status, next)) {
    throw new InvalidHumanTaskTransitionError(task.status, next);
  }
  return HumanTaskSchema.parse({
    ...task,
    status: next,
    updated_at: now.toISOString(),
  });
}

export class InvalidHumanTaskTransitionError extends Error {
  readonly code = "INVALID_HUMAN_TASK_TRANSITION";

  constructor(
    readonly from: HumanTaskStatus,
    readonly to: HumanTaskStatus,
  ) {
    super(`Human Task cannot transition from ${from} to ${to}.`);
    this.name = "InvalidHumanTaskTransitionError";
  }
}

export type HumanTaskKind = z.infer<typeof HumanTaskKindSchema>;
export type HumanTaskStatus = z.infer<typeof HumanTaskStatusSchema>;
export type HumanTask = z.infer<typeof HumanTaskSchema>;
export type HumanTaskCreate = z.infer<typeof HumanTaskCreateSchema>;
export type HumanTaskSubmission = z.infer<typeof HumanTaskSubmissionSchema>;
export type HumanTaskReceipt = z.infer<typeof HumanTaskReceiptSchema>;
export type HumanTaskUpdate = z.infer<typeof HumanTaskUpdateSchema>;
export type HumanTaskTransition = z.infer<typeof HumanTaskTransitionSchema>;
export type HumanTaskTransitionCommand = z.infer<typeof HumanTaskTransitionCommandSchema>;
