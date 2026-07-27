import { z } from "zod";

export const VISEPOD_PROTOCOL_VERSION = 1 as const;
export const VISEPOD_SIGNING_VERSION = "VISEPOD-HMAC-SHA256-V1" as const;
export const VISEPOD_AUDIO_SAMPLE_RATE_HZ = 16_000 as const;
export const VISEPOD_AUDIO_BITS_PER_SAMPLE = 16 as const;
export const VISEPOD_AUDIO_CHANNELS = 1 as const;
export const VISEPOD_TURN_AUDIO_MAX_BYTES = 960_000 as const;
export const VISEPOD_RESPONSE_MAX_SEGMENTS = 8 as const;
export const VISEPOD_RESPONSE_TEXT_MAX_BYTES = 256 as const;
export const VISEPOD_RESPONSE_AUDIO_MAX_BYTES = 192 as const;
export const VISEPOD_RESPONSE_MAX_DURATION_MS = 120_000 as const;

const UNRESERVED_TOKEN = /^[A-Za-z0-9._~-]+$/;
const LOWERCASE_SHA256_HEX = /^[a-f0-9]{64}$/;

export const VisePodDeviceIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(UNRESERVED_TOKEN, "deviceId must use RFC 3986 unreserved characters only");

export const VisePodNonceSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(UNRESERVED_TOKEN, "nonce must use RFC 3986 unreserved characters only");

export const VisePodTimestampSchema = z
  .number()
  .finite()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

export const VisePodSha256HexSchema = z
  .string()
  .regex(LOWERCASE_SHA256_HEX, "SHA-256 digest must be 64 lowercase hexadecimal characters");

export const VisePodTurnMetadataSchema = z
  .object({
    version: z.literal(VISEPOD_PROTOCOL_VERSION),
    deviceId: VisePodDeviceIdSchema,
    timestamp: VisePodTimestampSchema,
    nonce: VisePodNonceSchema,
    payloadSha256: VisePodSha256HexSchema,
    signature: VisePodSha256HexSchema,
    payloadBytes: z.number().int().min(1).max(VISEPOD_TURN_AUDIO_MAX_BYTES),
  })
  .strict();

export const VisePodTurnRequestSchema = z
  .object({
    metadata: VisePodTurnMetadataSchema,
    audio: z.instanceof(Uint8Array),
  })
  .superRefine((request, context) => {
    if (request.audio.byteLength !== request.metadata.payloadBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audio"],
        message: "audio byte length must equal metadata payloadBytes",
      });
    }
    if (request.audio.byteLength > VISEPOD_TURN_AUDIO_MAX_BYTES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audio"],
        message: "audio exceeds the VisePod v1 maximum payload size",
      });
    }
  });

const VisePodTextSchema = z
  .string()
  .min(1)
  .refine(isWellFormedUtf16, "text must not contain an unpaired surrogate")
  .refine(
    (value) => utf8ByteLength(value) <= VISEPOD_RESPONSE_TEXT_MAX_BYTES,
    `text must fit within ${VISEPOD_RESPONSE_TEXT_MAX_BYTES} UTF-8 bytes`,
  );

const VisePodAudioLocatorSchema = z
  .string()
  .min(1)
  .refine(isWellFormedUtf16, "audio must not contain an unpaired surrogate")
  .refine(
    (value) => utf8ByteLength(value) <= VISEPOD_RESPONSE_AUDIO_MAX_BYTES,
    `audio must fit within ${VISEPOD_RESPONSE_AUDIO_MAX_BYTES} UTF-8 bytes`,
  )
  .refine(isSafeHttpsUrl, "audio must be an HTTPS URL without embedded credentials");

export const VisePodTurnSegmentSchema = z
  .object({
    index: z
      .number()
      .int()
      .min(0)
      .max(VISEPOD_RESPONSE_MAX_SEGMENTS - 1),
    text: VisePodTextSchema,
    audio: VisePodAudioLocatorSchema,
    durationMs: z.number().int().positive().max(VISEPOD_RESPONSE_MAX_DURATION_MS),
  })
  .strict();

export const VisePodTurnResponseSchema = z
  .object({
    version: z.literal(VISEPOD_PROTOCOL_VERSION),
    segments: z.array(VisePodTurnSegmentSchema).min(1).max(VISEPOD_RESPONSE_MAX_SEGMENTS),
  })
  .strict()
  .superRefine((response, context) => {
    const indexes = response.segments.map((segment) => segment.index);
    const unique = new Set(indexes);
    if (unique.size !== indexes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "segment indexes must be unique",
      });
    }
    for (let index = 0; index < response.segments.length; index += 1) {
      if (!unique.has(index)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments"],
          message: "segment indexes must be contiguous from zero",
        });
        break;
      }
    }
  });

export const VisePodErrorCodeSchema = z.enum([
  "UNSUPPORTED_VERSION",
  "INVALID_METADATA",
  "INVALID_DEVICE_ID",
  "INVALID_TIMESTAMP",
  "INVALID_NONCE",
  "PAYLOAD_TOO_LARGE",
  "PAYLOAD_HASH_MISMATCH",
  "INVALID_SIGNATURE",
  "REPLAY_DETECTED",
  "DEVICE_UNAUTHORIZED",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const VisePodErrorResponseSchema = z
  .object({
    version: z.literal(VISEPOD_PROTOCOL_VERSION),
    error: z
      .object({
        code: VisePodErrorCodeSchema,
        retryAfterMs: z.number().int().positive().max(300_000).optional(),
      })
      .strict(),
  })
  .strict();

export const VisePodHealthResponseSchema = z
  .object({
    version: z.literal(VISEPOD_PROTOCOL_VERSION),
    status: z.enum(["ready", "unavailable"]),
    error: VisePodErrorResponseSchema.shape.error.optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.status === "ready" && response.error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "ready health responses must not include an error",
      });
    }
    if (response.status === "unavailable" && !response.error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "unavailable health responses must include an error",
      });
    }
  });

export const VisePodSignatureVector = {
  signingVersion: VISEPOD_SIGNING_VERSION,
  keyHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  deviceId: "device-001",
  timestamp: 1_700_000_000,
  nonce: "0123456789abcdef",
  payloadUtf8: "hello",
  payloadSha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  canonicalString:
    "VISEPOD-HMAC-SHA256-V1\n" +
    "device-001\n" +
    "1700000000\n" +
    "0123456789abcdef\n" +
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  signatureHex: "a104199354d94841a5a9b454f45aa8696287817c9fd37fc9f81c324f303cf36f",
} as const;

export function buildVisePodCanonicalSigningString(input: {
  deviceId: string;
  timestamp: number;
  nonce: string;
  payloadSha256: string;
}): string {
  const validated = z
    .object({
      deviceId: VisePodDeviceIdSchema,
      timestamp: VisePodTimestampSchema,
      nonce: VisePodNonceSchema,
      payloadSha256: VisePodSha256HexSchema,
    })
    .strict()
    .parse(input);

  return [
    VISEPOD_SIGNING_VERSION,
    validated.deviceId,
    String(validated.timestamp),
    validated.nonce,
    validated.payloadSha256,
  ].join("\n");
}

export function splitVisePodSentences(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [];

  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (!character || !isSentenceBoundary(normalized, index)) continue;

    const sentence = normalized.slice(start, index + 1).trim();
    if (sentence) sentences.push(sentence);
    start = index + 1;
  }

  const remainder = normalized.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

function isSentenceBoundary(value: string, index: number): boolean {
  const character = value[index];
  if (
    character === "。" ||
    character === "！" ||
    character === "？" ||
    character === "!" ||
    character === "?"
  ) {
    return true;
  }
  if (character !== ".") return false;

  const previous = value[index - 1] ?? "";
  const next = value[index + 1] ?? "";
  if (/\d/.test(previous) && /\d/.test(next)) return false;

  const throughPeriod = value.slice(0, index + 1);
  if (/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.)$/i.test(throughPeriod)) return false;
  if (/(?:\b[A-Za-z]\.){2,}$/.test(throughPeriod)) return false;

  return next === "" || /\s/.test(next) || /[\"')\]]/.test(next);
}

function isSafeHttpsUrl(value: string): boolean {
  if (value.trim() !== value) return false;

  const parts = /^https:\/\/([^/?#]+)(?:[/?#][^\s]*)?$/.exec(value);
  if (!parts) return false;

  const authority = parts[1];
  if (!authority || authority.includes("@")) return false;

  const hostAndPort =
    /^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?$/.exec(
      authority,
    );
  if (!hostAndPort) return false;

  const port = hostAndPort[2] ? Number(hostAndPort[2]) : undefined;
  return port === undefined || (port >= 1 && port <= 65_535);
}

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export type VisePodTurnMetadata = z.infer<typeof VisePodTurnMetadataSchema>;
export type VisePodTurnRequest = z.infer<typeof VisePodTurnRequestSchema>;
export type VisePodTurnSegment = z.infer<typeof VisePodTurnSegmentSchema>;
export type VisePodTurnResponse = z.infer<typeof VisePodTurnResponseSchema>;
export type VisePodErrorCode = z.infer<typeof VisePodErrorCodeSchema>;
export type VisePodErrorResponse = z.infer<typeof VisePodErrorResponseSchema>;
export type VisePodHealthResponse = z.infer<typeof VisePodHealthResponseSchema>;
