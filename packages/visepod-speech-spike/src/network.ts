import type { NetworkProfile, UploadMode } from "./types.js";

export const networkProfiles: readonly NetworkProfile[] = [
  { id: "wifi_good", chunkDelayMs: 0, jitterMs: 0, packetLossPercent: 0 },
  { id: "wifi_public", chunkDelayMs: 45, jitterMs: 20, packetLossPercent: 1 },
  { id: "wifi_weak", chunkDelayMs: 120, jitterMs: 60, packetLossPercent: 3 },
  {
    id: "wifi_disconnect",
    chunkDelayMs: 45,
    jitterMs: 20,
    packetLossPercent: 0,
    disconnectAfterChunk: 8,
  },
];

function seededUnitInterval(seed: number): number {
  const value = Math.sin(seed * 12_989.0 + 78_233.0) * 43_758.5453;
  return value - Math.floor(value);
}

export interface FrameDelivery {
  frame: Buffer;
  delayMs: number;
  disconnect: boolean;
}

export function createFrameDeliveryPlan(
  frames: readonly Buffer[],
  profile: NetworkProfile,
  mode: UploadMode,
): FrameDelivery[] {
  const deliveries: FrameDelivery[] = [];
  frames.forEach((frame, index) => {
    if (profile.disconnectAfterChunk === index) {
      deliveries.push({ frame, delayMs: 0, disconnect: true });
      return;
    }

    const drop = seededUnitInterval(index + 1) * 100 < profile.packetLossPercent;
    if (drop) {
      return;
    }

    const realTimeFrameDelay = mode === "upstream_streaming" ? 20 : 0;
    const jitter =
      profile.jitterMs === 0
        ? 0
        : Math.round((seededUnitInterval(index + 101) * 2 - 1) * profile.jitterMs);
    deliveries.push({
      frame,
      delayMs: Math.max(0, realTimeFrameDelay + profile.chunkDelayMs + jitter),
      disconnect: false,
    });
  });
  return deliveries;
}
