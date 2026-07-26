export interface ParsedPcmWave {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
}

export function parsePcmS16LeWave(input: Buffer): ParsedPcmWave {
  if (input.length < 44 || input.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("INVALID_WAV_RIFF");
  }
  if (input.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("INVALID_WAV_FORMAT");
  }

  let offset = 12;
  let format: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  let pcm: Buffer | undefined;

  while (offset + 8 <= input.length) {
    const chunkId = input.toString("ascii", offset, offset + 4);
    const chunkSize = input.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkSize;
    if (end > input.length) {
      throw new Error("INVALID_WAV_CHUNK");
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16 || input.readUInt16LE(start) !== 1) {
        throw new Error("UNSUPPORTED_WAV_CODEC");
      }
      format = {
        channels: input.readUInt16LE(start + 2),
        sampleRate: input.readUInt32LE(start + 4),
        bitsPerSample: input.readUInt16LE(start + 14),
      };
    } else if (chunkId === "data") {
      pcm = input.subarray(start, end);
    }

    offset = end + (chunkSize % 2);
  }

  if (!format || !pcm) {
    throw new Error("INCOMPLETE_WAV");
  }
  if (format.channels !== 1 || format.sampleRate !== 16_000 || format.bitsPerSample !== 16) {
    throw new Error("WAV_MUST_BE_PCM_S16LE_16K_MONO");
  }

  return {
    pcm,
    ...format,
    durationSeconds: pcm.length / (format.sampleRate * format.channels * 2),
  };
}

export function splitPcmIntoFrames(pcm: Buffer, frameBytes = 640): Buffer[] {
  if (!Number.isInteger(frameBytes) || frameBytes <= 0) {
    throw new Error("frameBytes must be a positive integer");
  }
  const frames: Buffer[] = [];
  for (let offset = 0; offset < pcm.length; offset += frameBytes) {
    frames.push(pcm.subarray(offset, Math.min(offset + frameBytes, pcm.length)));
  }
  return frames;
}
