import { randomUUID } from "node:crypto";
import {
  ChinaReadinessPersistenceRequestSchema,
  ChinaReadinessSavedAssessmentSchema,
  deriveChinaReadinessResult,
  type ChinaReadinessPersistenceRequest,
  type ChinaReadinessSavedAssessment,
} from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";
import type { VersionedTripService } from "../trip/versionedService.js";

export type ReadinessIdentity = Exclude<RequestIdentity, { kind: "none" }>;

export type ReadinessService = {
  save(
    input: ChinaReadinessPersistenceRequest,
    identity: ReadinessIdentity,
  ): Promise<ChinaReadinessSavedAssessment>;
  latest(
    identity: ReadinessIdentity,
    input?: { tripId?: string },
  ): Promise<ChinaReadinessSavedAssessment | null>;
};

export const DEFAULT_READINESS_RETENTION_DAYS = 180;

export function resolveReadinessRetentionDays(
  environment: Readonly<Record<string, string | undefined>>,
): number {
  const raw = environment.VISEPANDA_READINESS_RETENTION_DAYS;
  if (raw === undefined || raw === "") return DEFAULT_READINESS_RETENTION_DAYS;
  if (!/^\d+$/.test(raw)) {
    throw new Error("VISEPANDA_READINESS_RETENTION_DAYS must be a positive integer");
  }
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 1 || days > DEFAULT_READINESS_RETENTION_DAYS) {
    throw new Error(
      `VISEPANDA_READINESS_RETENTION_DAYS must be between 1 and ${DEFAULT_READINESS_RETENTION_DAYS}`,
    );
  }
  return days;
}

export class ReadinessTripRequiredError extends Error {
  readonly code = "READINESS_TRIP_REQUIRED";

  constructor() {
    super("An anonymous readiness result can only be saved to the current Trip.");
    this.name = "ReadinessTripRequiredError";
  }
}

export class ReadinessTripNotFoundError extends Error {
  readonly code = "READINESS_TRIP_NOT_FOUND";

  constructor() {
    super("The selected Trip is unavailable.");
    this.name = "ReadinessTripNotFoundError";
  }
}

type StoredReadinessAssessment = Omit<ChinaReadinessSavedAssessment, "tripId"> & {
  userId: string | null;
  tripId: string | null;
  retentionExpiresAt: Date;
};

export function createInMemoryReadinessService(options: {
  tripService: VersionedTripService;
  now?: () => Date;
  retentionDays?: number;
}): ReadinessService {
  const records: StoredReadinessAssessment[] = [];
  const now = options.now ?? (() => new Date());
  const retentionDays = options.retentionDays ?? DEFAULT_READINESS_RETENTION_DAYS;

  return {
    async save(input, identity) {
      const parsed = ChinaReadinessPersistenceRequestSchema.parse(input);
      await assertTripAccess(options.tripService, identity, parsed.tripId);
      const savedAt = now();
      const record = ChinaReadinessSavedAssessmentSchema.parse({
        id: randomUUID(),
        assessment: parsed.assessment,
        result: deriveChinaReadinessResult(parsed.assessment),
        ...(parsed.tripId ? { tripId: parsed.tripId } : {}),
        savedAt: savedAt.toISOString(),
      });
      records.push({
        ...record,
        userId: identity.kind === "authenticated" ? identity.userId : null,
        tripId: parsed.tripId ?? null,
        retentionExpiresAt: retentionDeadline(savedAt, retentionDays),
      });
      return cloneRecord(record);
    },

    async latest(identity, input) {
      await assertTripAccess(options.tripService, identity, input?.tripId);
      const record = [...records]
        .reverse()
        .find(
          (candidate) =>
            candidate.retentionExpiresAt > now() &&
            recordBelongsTo(candidate, identity, input?.tripId),
        );
      return record ? publicRecord(record) : null;
    },
  };
}

function retentionDeadline(createdAt: Date, retentionDays: number): Date {
  return new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function assertTripAccess(
  tripService: VersionedTripService,
  identity: ReadinessIdentity,
  tripId: string | undefined,
): Promise<void> {
  if (!tripId) {
    if (identity.kind === "anonymous") throw new ReadinessTripRequiredError();
    return;
  }
  if (!(await tripService.get(tripId, identity))) throw new ReadinessTripNotFoundError();
}

function recordBelongsTo(
  record: StoredReadinessAssessment,
  identity: ReadinessIdentity,
  tripId: string | undefined,
): boolean {
  if (tripId) return record.tripId === tripId;
  return identity.kind === "authenticated" && record.userId === identity.userId;
}

function cloneRecord(record: ChinaReadinessSavedAssessment): ChinaReadinessSavedAssessment {
  return ChinaReadinessSavedAssessmentSchema.parse(structuredClone(record));
}

function publicRecord(record: StoredReadinessAssessment): ChinaReadinessSavedAssessment {
  return ChinaReadinessSavedAssessmentSchema.parse({
    id: record.id,
    assessment: record.assessment,
    result: record.result,
    ...(record.tripId ? { tripId: record.tripId } : {}),
    savedAt: record.savedAt,
  });
}
