import {
  HumanTaskCreateSchema,
  createHumanTask,
  type HumanTask,
  type HumanTaskCreate,
} from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";

export const HUMAN_TASK_PREVIEW_CITY = "Shanghai";
export const HUMAN_TASK_DAILY_CAPACITY = 5;

export type HumanTaskIdentity = Exclude<RequestIdentity, { kind: "none" }>;

export type CreateHumanTaskCommand = {
  identity: HumanTaskIdentity;
  idempotencyKey: string;
  request: HumanTaskCreate;
};

export type HumanTaskService = {
  create(input: CreateHumanTaskCommand): Promise<HumanTask>;
  listForOwner(identity: HumanTaskIdentity): Promise<HumanTask[]>;
  listForOps(): Promise<HumanTask[]>;
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

type OwnedTask = {
  task: HumanTask;
  identity: HumanTaskIdentity;
  idempotencyKey: string;
};

export function createInMemoryHumanTaskService(options?: { now?: () => Date }): HumanTaskService {
  const now = options?.now ?? (() => new Date());
  let records: OwnedTask[] = [];

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
  };
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
