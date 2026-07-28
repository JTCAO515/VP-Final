import { describe, expect, it } from "vitest";

import { parsePcmS16LeWave, splitPcmIntoFrames } from "./audio.js";

function pcmWave(pcm: Buffer, sampleRate = 16_000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

describe("PCM fixture parsing", () => {
  it("accepts PCM S16LE 16 kHz mono and derives duration", () => {
    const parsed = parsePcmS16LeWave(pcmWave(Buffer.alloc(32_000)));
    expect(parsed.durationSeconds).toBe(1);
    expect(parsed.pcm).toHaveLength(32_000);
  });

  it("rejects an incompatible sample rate", () => {
    expect(() => parsePcmS16LeWave(pcmWave(Buffer.alloc(8), 8_000))).toThrow(
      "WAV_MUST_BE_PCM_S16LE_16K_MONO",
    );
  });

  it("splits 20 ms 16 kHz mono frames into 640 bytes", () => {
    expect(splitPcmIntoFrames(Buffer.alloc(1_281)).map((frame) => frame.length)).toEqual([
      640, 640, 1,
    ]);
  });
});
