import { describe, expect, it } from "vitest";

import {
  createMobileTelemetryEvent,
  createMobileTelemetryQueue,
  enqueueMobileTelemetry,
  flushMobileTelemetryQueue,
  MobileTelemetryQueueFullError,
} from "./mobile-telemetry.js";

const toolOpened = {
  action: "tool_opened" as const,
  entity_type: "tool",
  entity_id: "translation",
  props_jsonb: { tool: "translation" },
};

describe("mobile telemetry queue", () => {
  it("persists only domain-validated, content-free telemetry events", () => {
    const event = createMobileTelemetryEvent(toolOpened);
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(() =>
      createMobileTelemetryEvent({
        ...toolOpened,
        props_jsonb: { tool: "translation", prompt: "raw traveler text" },
      }),
    ).toThrow();
  });

  it("keeps failed events in order and removes only accepted receipts", async () => {
    const first = createMobileTelemetryEvent({ action: "app_opened", entity_type: "mobile_app" });
    const second = createMobileTelemetryEvent(toolOpened);
    const queue = enqueueMobileTelemetry(
      enqueueMobileTelemetry(createMobileTelemetryQueue(), first),
      second,
    );
    const remaining = await flushMobileTelemetryQueue({
      accessToken: "access-token",
      baseUrl: "https://go2china.space",
      queue,
      fetcher: async (_url, init) => {
        expect(init?.headers).toEqual({
          Authorization: "Bearer access-token",
          "content-type": "application/json",
        });
        return new Response(JSON.stringify({ ok: false }), { status: 503 });
      },
    });
    expect(remaining).toEqual(queue);

    const delivered = await flushMobileTelemetryQueue({
      accessToken: "access-token",
      baseUrl: "https://go2china.space",
      queue,
      fetcher: async () => new Response(JSON.stringify({ ok: true }), { status: 202 }),
    });
    expect(delivered.events).toEqual([]);
  });

  it("does not silently evict a queued observation when capacity is reached", () => {
    let queue = createMobileTelemetryQueue();
    for (let index = 0; index < 100; index += 1) {
      queue = enqueueMobileTelemetry(
        queue,
        createMobileTelemetryEvent({ action: "app_opened", entity_type: `app-${index}` }),
      );
    }
    expect(() => enqueueMobileTelemetry(queue, createMobileTelemetryEvent(toolOpened))).toThrow(
      MobileTelemetryQueueFullError,
    );
  });
});
