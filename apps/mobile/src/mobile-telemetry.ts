import {
  MobileTelemetryCaptureInputSchema,
  type MobileTelemetryCaptureInput,
} from "@visepanda/domain";

export const MOBILE_TELEMETRY_QUEUE_VERSION = 1 as const;
export const MOBILE_TELEMETRY_QUEUE_MAX_EVENTS = 100;

export type MobileTelemetryQueue = {
  events: MobileTelemetryCaptureInput[];
  version: typeof MOBILE_TELEMETRY_QUEUE_VERSION;
};

type MobileTelemetryEventDraft = Omit<MobileTelemetryCaptureInput, "id" | "props_jsonb"> & {
  props_jsonb?: Record<string, unknown> | undefined;
};

export class MobileTelemetryQueueFullError extends Error {
  constructor() {
    super("Mobile telemetry queue is full.");
    this.name = "MobileTelemetryQueueFullError";
  }
}

export function createMobileTelemetryQueue(): MobileTelemetryQueue {
  return { version: MOBILE_TELEMETRY_QUEUE_VERSION, events: [] };
}

export function createMobileTelemetryEvent(
  input: MobileTelemetryEventDraft,
): MobileTelemetryCaptureInput {
  return MobileTelemetryCaptureInputSchema.parse({
    ...input,
    id: createMobileTelemetryId(),
    props_jsonb: input.props_jsonb ?? {},
  });
}

export function enqueueMobileTelemetry(
  queue: MobileTelemetryQueue,
  event: MobileTelemetryCaptureInput,
): MobileTelemetryQueue {
  const parsedQueue = parseMobileTelemetryQueue(queue);
  const parsedEvent = MobileTelemetryCaptureInputSchema.parse(event);
  if (parsedQueue.events.some((candidate) => candidate.id === parsedEvent.id)) return parsedQueue;
  if (parsedQueue.events.length >= MOBILE_TELEMETRY_QUEUE_MAX_EVENTS) {
    throw new MobileTelemetryQueueFullError();
  }
  return parseMobileTelemetryQueue({
    ...parsedQueue,
    events: [...parsedQueue.events, parsedEvent],
  });
}

export async function flushMobileTelemetryQueue(input: {
  accessToken: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  queue: MobileTelemetryQueue;
}): Promise<MobileTelemetryQueue> {
  const fetcher = input.fetcher ?? fetch;
  const queue = parseMobileTelemetryQueue(input.queue);
  let firstPending = 0;

  for (const event of queue.events) {
    let response: Response;
    try {
      response = await fetcher(`${input.baseUrl}/api/mobile/telemetry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(event),
      });
    } catch {
      break;
    }
    if (response.status !== 202) break;
    firstPending += 1;
  }

  return parseMobileTelemetryQueue({
    ...queue,
    events: queue.events.slice(firstPending),
  });
}

export function parseMobileTelemetryQueue(value: unknown): MobileTelemetryQueue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Mobile telemetry queue must be an object");
  }
  const candidate = value as { events?: unknown; version?: unknown };
  if (candidate.version !== MOBILE_TELEMETRY_QUEUE_VERSION || !Array.isArray(candidate.events)) {
    throw new Error("Mobile telemetry queue version is invalid");
  }
  if (candidate.events.length > MOBILE_TELEMETRY_QUEUE_MAX_EVENTS) {
    throw new Error("Mobile telemetry queue exceeds its maximum size");
  }
  const events = candidate.events.map((event) => MobileTelemetryCaptureInputSchema.parse(event));
  if (new Set(events.map((event) => event.id)).size !== events.length) {
    throw new Error("Mobile telemetry event ids must be unique");
  }
  return { version: MOBILE_TELEMETRY_QUEUE_VERSION, events };
}

function createMobileTelemetryId(random = Math.random): string {
  const values = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  values[6] = (values[6]! & 0x0f) | 0x40;
  values[8] = (values[8]! & 0x3f) | 0x80;
  const hex = values.map((value) => value!.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
