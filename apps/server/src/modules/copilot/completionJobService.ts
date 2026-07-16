import {
  CompletionJobSchema,
  canTransitionCompletionJob,
  type CompletionJob,
  type CompletionJobState,
} from "@visepanda/domain";
import type { TripIdentity, VersionedTripService } from "../trip/versionedService.js";

export type CreateCompletionJobInput = {
  tripId: string;
  baseVersion: number;
  idempotencyKey: string;
  maxAttempts: number;
};

export type ClaimedCompletionJob = {
  job: CompletionJob;
  identity: TripIdentity;
};

export interface CompletionJobService {
  create(input: CreateCompletionJobInput, identity: TripIdentity): Promise<CompletionJob>;
  get(id: string, identity: TripIdentity): Promise<CompletionJob | null>;
  claim(id: string, idempotencyKey: string): Promise<ClaimedCompletionJob | null>;
  settle(
    id: string,
    attempt: number,
    state: Extract<CompletionJobState, "completed" | "partial" | "failed" | "conflicted">,
    errorCode?: string,
  ): Promise<CompletionJob | null>;
  requeue(id: string, attempt: number): Promise<CompletionJob | null>;
  retry(id: string, idempotencyKey: string, identity: TripIdentity): Promise<CompletionJob | null>;
}

type StoredJob = {
  job: CompletionJob;
  identity: TripIdentity;
};

export const COMPLETION_CLAIM_LEASE_MS = 10 * 60 * 1_000;

export function createInMemoryCompletionJobService(
  tripService: VersionedTripService,
  options: { now?: () => Date; claimLeaseMs?: number } = {},
): CompletionJobService {
  const jobs = new Map<string, StoredJob>();
  const now = options.now ?? (() => new Date());
  const claimLeaseMs = options.claimLeaseMs ?? COMPLETION_CLAIM_LEASE_MS;

  function requeueStored(id: string, attempt: number): CompletionJob | null {
    const stored = jobs.get(id);
    if (
      !stored ||
      stored.job.attempt !== attempt ||
      !["partial", "failed"].includes(stored.job.state) ||
      stored.job.attempt >= stored.job.maxAttempts
    ) {
      return null;
    }
    stored.job = transition(stored.job, "queued", { completedAt: null });
    return cloneJob(stored.job);
  }

  return {
    async create(input, identity) {
      const snapshot = await tripService.get(input.tripId, identity);
      if (!snapshot) throw new Error("Trip not found.");
      if (snapshot.version !== input.baseVersion) {
        throw new Error("Trip changed before completion was queued.");
      }
      const existing = [...jobs.values()].find(
        ({ job }) => job.tripId === input.tripId && job.baseVersion === input.baseVersion,
      );
      if (existing) return cloneJob(existing.job);

      const timestamp = now().toISOString();
      const job = CompletionJobSchema.parse({
        id: crypto.randomUUID(),
        ...input,
        state: "queued",
        attempt: 0,
        errorCode: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: null,
        completedAt: null,
      });
      jobs.set(job.id, { job, identity: cloneIdentity(identity) });
      return cloneJob(job);
    },

    async get(id, identity) {
      const stored = jobs.get(id);
      return stored && sameIdentity(stored.identity, identity) ? cloneJob(stored.job) : null;
    },

    async claim(id, idempotencyKey) {
      const stored = jobs.get(id);
      if (!stored || stored.job.idempotencyKey !== idempotencyKey) {
        return null;
      }
      const timestamp = now();
      const isQueued = stored.job.state === "queued" && stored.job.attempt < stored.job.maxAttempts;
      const isExpiredRunning =
        stored.job.state === "running" &&
        stored.job.startedAt !== null &&
        timestamp.getTime() - new Date(stored.job.startedAt).getTime() >= claimLeaseMs;
      if (!isQueued && !isExpiredRunning) return null;
      const attempt =
        isQueued || stored.job.attempt < stored.job.maxAttempts
          ? stored.job.attempt + 1
          : stored.job.attempt;
      stored.job = transition(stored.job, "running", {
        attempt,
        startedAt: timestamp.toISOString(),
        completedAt: null,
        errorCode: null,
      });
      return { job: cloneJob(stored.job), identity: cloneIdentity(stored.identity) };
    },

    async settle(id, attempt, state, errorCode) {
      const stored = jobs.get(id);
      if (!stored || stored.job.state !== "running" || stored.job.attempt !== attempt) return null;
      stored.job = transition(stored.job, state, {
        errorCode: errorCode ?? null,
        completedAt:
          state === "completed" || state === "conflicted" || attempt >= stored.job.maxAttempts
            ? new Date().toISOString()
            : null,
      });
      return cloneJob(stored.job);
    },

    async requeue(id, attempt) {
      return requeueStored(id, attempt);
    },

    async retry(id, idempotencyKey, identity) {
      const stored = jobs.get(id);
      if (
        !stored ||
        stored.job.idempotencyKey !== idempotencyKey ||
        !sameIdentity(stored.identity, identity)
      ) {
        return null;
      }
      if (stored.job.state === "queued") return cloneJob(stored.job);
      return requeueStored(id, stored.job.attempt);
    },
  };
}

function transition(
  job: CompletionJob,
  state: CompletionJobState,
  fields: Partial<CompletionJob>,
): CompletionJob {
  if (!canTransitionCompletionJob(job.state, state)) {
    throw new Error(`Invalid completion job transition: ${job.state} -> ${state}`);
  }
  return CompletionJobSchema.parse({
    ...job,
    ...fields,
    state,
    updatedAt: new Date().toISOString(),
  });
}

function sameIdentity(left: TripIdentity, right: TripIdentity): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "anonymous"
      ? left.anonId === (right.kind === "anonymous" ? right.anonId : null)
      : left.userId === (right.kind === "authenticated" ? right.userId : null))
  );
}

function cloneIdentity(identity: TripIdentity): TripIdentity {
  return { ...identity };
}

function cloneJob(job: CompletionJob): CompletionJob {
  return CompletionJobSchema.parse(structuredClone(job));
}
