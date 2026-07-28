import { describe, expect, it } from "vitest";

import { createFrameDeliveryPlan } from "./network.js";

describe("Wi-Fi impairment plan", () => {
  const frames = Array.from({ length: 10 }, () => Buffer.alloc(640));

  it("adds real-time pacing only for upstream streaming", () => {
    const profile = { id: "good", chunkDelayMs: 0, jitterMs: 0, packetLossPercent: 0 };
    expect(createFrameDeliveryPlan(frames, profile, "buffer_on_commit")[0]?.delayMs).toBe(0);
    expect(createFrameDeliveryPlan(frames, profile, "upstream_streaming")[0]?.delayMs).toBe(20);
  });

  it("creates a deterministic disconnect observation", () => {
    const plan = createFrameDeliveryPlan(
      frames,
      {
        id: "disconnect",
        chunkDelayMs: 0,
        jitterMs: 0,
        packetLossPercent: 0,
        disconnectAfterChunk: 3,
      },
      "buffer_on_commit",
    );
    expect(plan.find((delivery) => delivery.disconnect)).toEqual({
      frame: frames[3],
      delayMs: 0,
      disconnect: true,
    });
  });
});
