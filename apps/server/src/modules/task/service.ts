import {
  HumanTaskCreateSchema,
  HumanTaskSchema,
  HumanTaskTransitionCommandSchema,
  HumanTaskTransitionSchema,
  HumanTaskUpdateSchema,
  HumanTaskEvidenceSchema,
  isHumanTaskEvidenceWindowCurrent,
  sanitizeHumanTaskEvidence,
  createHumanTask,
  transitionHumanTask,
  type HumanTask,
  type HumanTaskCreate,
  type HumanTaskStatus,
  type HumanTaskTransition,
  type HumanTaskEvidence,
  type HumanTaskEvidenceInput,
} from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";
import type { OpsAccess } from "../opsAuthorization/service.js";

export const HUMAN_TASK_PREVIEW_CITY = "Shanghai";
export const HUMAN_TASK_DAILY_CAPACITY = 5;
export const HUMAN_TASK_TERMINAL_RETENTION_DAYS = 90;

export type HumanTaskIdentity = Exclude<RequestIdentity, { kind: "none" }>;

export type CreateHumanTaskCommand = {
  identity: HumanTaskIdentity;
  idempotencyKey: string;
  request: HumanTaskCreate;
};

export type TransitionHumanTaskCommand = {
  taskId: string;
  actor: OpsAccess;
  toStatus: HumanTaskStatus;
  reason: string;
};

export type UpdateHumanTaskNoteCommand = {
  taskId: string;
  actor: OpsAccess;
  note: string | null;
};

export type AppendHumanTaskEvidenceCommand = {
  taskId: string;
  actor: OpsAccess;
  evidence: HumanTaskEvidenceInput;
};

export type HumanTaskTransitionResult = {
  task: HumanTask;
  transition: HumanTaskTransition;
};

export type HumanTaskService = {
  create(input: CreateHumanTaskCommand): Promise<HumanTask>;
  listForOwner(identity: HumanTaskIdentity): Promise<HumanTask[]>;
  listForOps(): Promise<HumanTask[]>;
  getForOps(taskId: string, actor: OpsAccess): Promise<HumanTask>;
  updateOperatorNote(input: UpdateHumanTaskNoteCommand): Promise<HumanTask>;
  appendEvidence(input: AppendHumanTaskEvidenceCommand): Promise<HumanTaskEvidence>;
  listEvidence(taskId: string, actor: OpsAccess): Promise<HumanTaskEvidence[]>;
  transition(input: TransitionHumanTaskCommand): Promise<HumanTaskTransitionResult>;
  listTransitions(taskId: string, actor: OpsAccess): Promise<HumanTaskTransition[]>;
};

export class HumanTaskCapacityError extends Error {
  readonly code = "HUMAN_TASK_CAPACITY_REACHED";

  constructor() {
    super("Human Help has reached its request capacity for today.");
    this.name = "HumanTaskCapacityError";
  }
}

export class HumanTaskPreviewScopeError extends Error {
  readonly code = "HUMAN_TASK_OUTSIDE_PREVIEW";

  constructor() {
    super("Human Help is currently available only for requests in Shanghai.");
    this.name = "HumanTaskPreviewScopeError";
  }
}

export class HumanTaskIdempotencyConflictError extends Error {
  readonly code = "HUMAN_TASK_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("The Human Help request could not be safely replayed.");
    this.name = "HumanTaskIdempotencyConflictError";
  }
}

export class HumanTaskNotFoundError extends Error {
  readonly code = "HUMAN_TASK_NOT_FOUND";

  constructor() {
    super("Human Task was not found.");
    this.name = "HumanTaskNotFoundError";
  }
}

export class HumanTaskTransitionForbiddenError extends Error {
  readonly code = "HUMAN_TASK_TRANSITION_FORBIDDEN";

  constructor() {
    super("This Ops role cannot change Human Task status.");
    this.name = "HumanTaskTransitionForbiddenError";
  }
}

export class HumanTaskTransitionPolicyError extends Error {
  readonly code = "HUMAN_TASK_TRANSITION_POLICY_BLOCKED";

  constructor() {
    super("This Human Task transition is not enabled during the controlled preview.");
    this.name = "HumanTaskTransitionPolicyError";
  }
}

export class HumanTaskEvidencePolicyError extends Error {
  readonly code = "HUMAN_TASK_EVIDENCE_POLICY";

  constructor() {
    super("Human Task evidence is available only for a current done or cancelled task.");
    this.name = "HumanTaskEvidencePolicyError";
  }
}

type OwnedTask = {
  task: HumanTask;
  identity: HumanTaskIdentity;
  idempotencyKey: string;
};

export function createInMemoryHumanTaskService(options?: { now?: () => Date }): HumanTaskService {
  const now = options?.now ?? (() => new Date());
  let records: OwnedTask[] = [];
  const transitions: HumanTaskTransition[] = [];
  const evidenceRecords: HumanTaskEvidence[] = [];

  return {
    async create(input) {
      const request = validateHumanTaskPreviewRequest(input.request);
      const replay = records.find((record) => record.idempotencyKey === input.idempotencyKey);
      if (replay) {
        if (!sameIdentity(replay.identity, input.identity) || !sameRequest(replay.task, request)) {
          throw new HumanTaskIdempotencyConflictError();
        }
        return replay.task;
      }

      const requestedAt = now();
      const requestDay = chinaDayKey(requestedAt);
      if (
        records.filter((record) => chinaDayKey(new Date(record.task.created_at)) === requestDay)
          .length >= HUMAN_TASK_DAILY_CAPACITY
      ) {
        throw new HumanTaskCapacityError();
      }
      const task = createHumanTask(request, requestedAt);
      records = [
        { task, identity: input.identity, idempotencyKey: input.idempotencyKey },
        ...records,
      ];
      return task;
    },
    async listForOwner(identity) {
      return records
        .filter((record) => sameIdentity(record.identity, identity))
        .map((record) => record.task);
    },
    async listForOps() {
      return records.map((record) => record.task);
    },
    async getForOps(taskId, actor) {
      assertTaskPermission(actor, "task.contact.read");
      const record = records.find((entry) => entry.task.id === taskId);
      if (!record) throw new HumanTaskNotFoundError();
      return record.task;
    },
    async updateOperatorNote(input) {
      assertTaskPermission(input.actor, "task.write");
      const index = records.findIndex((record) => record.task.id === input.taskId);
      if (index < 0) throw new HumanTaskNotFoundError();
      const update = HumanTaskUpdateSchema.parse({
        id: input.taskId,
        operator_note: input.note,
      });
      const record = records[index]!;
      const task = HumanTaskSchema.parse({
        ...record.task,
        operator_note: update.operator_note,
        updated_at: now().toISOString(),
      });
      records[index] = { ...record, task };
      return task;
    },
    async appendEvidence(input) {
      assertTaskPermission(input.actor, "task.write");
      const record = records.find((entry) => entry.task.id === input.taskId);
      if (!record || !isHumanTaskEvidenceWindowCurrent(record.task, now())) {
        throw new HumanTaskEvidencePolicyError();
      }
      const sanitized = sanitizeHumanTaskEvidence(input.evidence);
      const evidence = HumanTaskEvidenceSchema.parse({
        id: crypto.randomUUID(),
        task_id: input.taskId,
        kind: input.evidence.kind,
        content: sanitized.content,
        redaction_classes: sanitized.redactionClasses,
        actor_id: input.actor.userId,
        created_at: now().toISOString(),
      });
      evidenceRecords.push(evidence);
      return evidence;
    },
    async listEvidence(taskId, actor) {
      assertTaskPermission(actor, "task.contact.read");
      const record = records.find((entry) => entry.task.id === taskId);
      if (!record) throw new HumanTaskNotFoundError();
      if (!isHumanTaskEvidenceWindowCurrent(record.task, now())) return [];
      return evidenceRecords.filter((evidence) => evidence.task_id === taskId);
    },
    async transition(input) {
      const index = records.findIndex((record) => record.task.id === input.taskId);
      if (index < 0) throw new HumanTaskNotFoundError();
      const record = records[index]!;
      const { task, transition } = prepareHumanTaskTransition(record.task, input, now());
      records[index] = { ...record, task };
      transitions.push(transition);
      return { task, transition };
    },
    async listTransitions(taskId, actor) {
      assertTaskPermission(actor, "task.read");
      return transitions.filter((transition) => transition.task_id === taskId);
    },
  };
}

export function prepareHumanTaskTransition(
  current: HumanTask,
  input: TransitionHumanTaskCommand,
  now: Date,
): HumanTaskTransitionResult {
  assertTaskPermission(input.actor, "task.write");
  const command = HumanTaskTransitionCommandSchema.parse({
    to_status: input.toStatus,
    reason: input.reason,
  });
  const task = applyHumanTaskTransition(current, command.to_status, now);
  const transition = HumanTaskTransitionSchema.parse({
    id: crypto.randomUUID(),
    task_id: task.id,
    from_status: current.status,
    to_status: task.status,
    actor_id: input.actor.userId,
    reason: command.reason,
    created_at: now.toISOString(),
  });
  return { task, transition };
}

export function applyHumanTaskTransition(
  task: HumanTask,
  next: HumanTaskStatus,
  now: Date,
): HumanTask {
  const transitioned = transitionHumanTask(task, next, now);
  if (!isPreviewTransitionEnabled(task.status, next)) {
    throw new HumanTaskTransitionPolicyError();
  }
  return HumanTaskSchema.parse({
    ...transitioned,
    retention_expires_at:
      next === "done" || next === "cancelled"
        ? new Date(now.getTime() + HUMAN_TASK_TERMINAL_RETENTION_DAYS * 86_400_000).toISOString()
        : transitioned.retention_expires_at,
  });
}

function isPreviewTransitionEnabled(from: HumanTaskStatus, to: HumanTaskStatus): boolean {
  return (
    (from === "requested" && (to === "triaged" || to === "cancelled")) ||
    (from === "triaged" && to === "cancelled")
  );
}

function assertTaskPermission(
  actor: OpsAccess,
  permission: "task.read" | "task.contact.read" | "task.write",
): void {
  if (!actor.permissions.includes(permission)) throw new HumanTaskTransitionForbiddenError();
}

export function validateHumanTaskPreviewRequest(input: HumanTaskCreate): HumanTaskCreate {
  const request = HumanTaskCreateSchema.parse(input);
  if (request.city !== HUMAN_TASK_PREVIEW_CITY) throw new HumanTaskPreviewScopeError();
  return request;
}

export function chinaDayKey(now: Date): string {
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

function sameIdentity(left: HumanTaskIdentity, right: HumanTaskIdentity): boolean {
  if (left.kind !== right.kind) return false;
  return left.kind === "anonymous"
    ? left.anonId === (right as Extract<HumanTaskIdentity, { kind: "anonymous" }>).anonId
    : left.userId === (right as Extract<HumanTaskIdentity, { kind: "authenticated" }>).userId;
}

function sameRequest(task: HumanTask, request: HumanTaskCreate): boolean {
  return (
    task.city === request.city &&
    task.kind === request.kind &&
    task.description === request.description &&
    task.contact === request.contact
  );
}
