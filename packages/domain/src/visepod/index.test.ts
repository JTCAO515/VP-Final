import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildVisePodCanonicalSigningString,
  splitVisePodSentences,
  VisePodHealthResponseSchema,
  VisePodSignatureVector,
  VisePodTurnMetadataSchema,
  VisePodTurnRequestSchema,
  VisePodTurnResponseSchema,
  VISEPOD_TURN_AUDIO_MAX_BYTES,
} from "./index.js";

const metadata = {
  version: 1,
  deviceId: "device-001",
  timestamp: 1_700_000_000,
  nonce: "0123456789abcdef",
  payloadSha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  signature: "a104199354d94841a5a9b454f45aa8696287817c9fd37fc9f81c324f303cf36f",
  payloadBytes: 5,
};

describe("VisePod v1 turn contract", () => {
  it("accepts the signed PCM request shape and rejects mismatched audio length", () => {
    expect(
      VisePodTurnRequestSchema.parse({ metadata, audio: new TextEncoder().encode("hello") }),
    ).toEqual({
      metadata,
      audio: new TextEncoder().encode("hello"),
    });

    expect(
      VisePodTurnRequestSchema.safeParse({
        metadata,
        audio: new Uint8Array([1, 2, 3]),
      }).success,
    ).toBe(false);
  });

  it("rejects non-unreserved device ids, invalid nonces, and oversized PCM metadata", () => {
    expect(
      VisePodTurnMetadataSchema.safeParse({ ...metadata, deviceId: "device/001" }).success,
    ).toBe(false);
    expect(
      VisePodTurnMetadataSchema.safeParse({ ...metadata, nonce: "bad nonce value" }).success,
    ).toBe(false);
    expect(
      VisePodTurnMetadataSchema.safeParse({
        ...metadata,
        payloadBytes: VISEPOD_TURN_AUDIO_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("validates index-carrying sentence segments without relying on array order", () => {
    const result = VisePodTurnResponseSchema.safeParse({
      version: 1,
      segments: [
        {
          index: 1,
          text: "Then take Metro Line 10.",
          audio: "https://audio.example.test/turn/1",
          durationMs: 1200,
        },
        {
          index: 0,
          text: "Welcome to Shanghai.",
          audio: "https://audio.example.test/turn/0",
          durationMs: 1000,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(
      VisePodTurnResponseSchema.safeParse({
        version: 1,
        segments: [
          { index: 0, text: "One.", audio: "https://audio.example.test/one", durationMs: 1 },
          { index: 0, text: "Two.", audio: "https://audio.example.test/two", durationMs: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      VisePodTurnResponseSchema.safeParse({
        version: 1,
        segments: [
          { index: 1, text: "Only.", audio: "https://audio.example.test/only", durationMs: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires a credential-free HTTPS audio locator", () => {
    const segment = {
      index: 0,
      text: "One.",
      durationMs: 1,
    };

    expect(
      VisePodTurnResponseSchema.safeParse({
        version: 1,
        segments: [{ ...segment, audio: "http://audio.example.test/one" }],
      }).success,
    ).toBe(false);
    expect(
      VisePodTurnResponseSchema.safeParse({
        version: 1,
        segments: [{ ...segment, audio: "https://token@audio.example.test/one" }],
      }).success,
    ).toBe(false);
  });

  it("keeps health responses truthful", () => {
    expect(VisePodHealthResponseSchema.safeParse({ version: 1, status: "ready" }).success).toBe(
      true,
    );
    expect(
      VisePodHealthResponseSchema.safeParse({
        version: 1,
        status: "ready",
        error: { code: "INTERNAL_ERROR" },
      }).success,
    ).toBe(false);
    expect(
      VisePodHealthResponseSchema.safeParse({ version: 1, status: "unavailable" }).success,
    ).toBe(false);
  });
});

describe("VisePod v1 cross-language signing vector", () => {
  it("matches the firmware canonical string, payload digest, and HMAC-SHA256 hex", () => {
    const payloadDigest = createHash("sha256")
      .update(VisePodSignatureVector.payloadUtf8, "utf8")
      .digest("hex");
    expect(payloadDigest).toBe(VisePodSignatureVector.payloadSha256);

    const canonical = buildVisePodCanonicalSigningString({
      deviceId: VisePodSignatureVector.deviceId,
      timestamp: VisePodSignatureVector.timestamp,
      nonce: VisePodSignatureVector.nonce,
      payloadSha256: payloadDigest,
    });
    expect(canonical).toBe(VisePodSignatureVector.canonicalString);

    const signature = createHmac("sha256", Buffer.from(VisePodSignatureVector.keyHex, "hex"))
      .update(canonical, "utf8")
      .digest("hex");
    expect(signature).toBe(VisePodSignatureVector.signatureHex);
  });
});

describe("VisePod sentence splitting", () => {
  it("does not split English titles, initialisms, or decimals at an internal period", () => {
    expect(
      splitVisePodSentences("Mr. Wang paid 3.5 yuan. U.S. visitors can use it! Great."),
    ).toEqual(["Mr. Wang paid 3.5 yuan.", "U.S. visitors can use it!", "Great."]);
  });

  it("splits Chinese and English sentence punctuation into stable playback units", () => {
    expect(splitVisePodSentences("您好！请出示护照。Then take Metro Line 10?")).toEqual([
      "您好！",
      "请出示护照。",
      "Then take Metro Line 10?",
    ]);
  });
});
