import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { constants, createHash, createPublicKey, verify } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "docs/visepod/fixtures/device-auth-v1-vectors.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function base64UrlToBuffer(value) {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

function canonicalize(fields, fieldOrder) {
  return Buffer.from(
    fieldOrder
      .map((field) => {
        const value = fields[field];
        assert(typeof value === "string" && value.length > 0, `missing ${field}`);
        assert(!/[\r\n]/u.test(value), `${field} contains a newline`);
        assert(/^[\x20-\x7e]+$/u.test(value), `${field} is not ASCII`);
        return value;
      })
      .join("\n"),
    "utf8",
  );
}

function containsForbiddenKey(value) {
  const forbidden = new Set([
    "privateKey",
    "privateKeyPem",
    "deviceSecret",
    "sessionToken",
    "rawToken",
  ]);
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) => forbidden.has(key) || containsForbiddenKey(nested),
    );
  }
  return false;
}

assert(fixture.schemaVersion === 1, "unsupported fixture schema");
assert(fixture.algorithm === "RSA-PSS-SHA256", "unexpected algorithm");
assert(fixture.saltLengthBytes === 32, "unexpected RSA-PSS salt length");
assert(!containsForbiddenKey(fixture), "fixture contains forbidden secret/token material");
assert(
  JSON.stringify(fixture.canonicalFieldOrder) ===
    JSON.stringify([
      "protocol",
      "deviceId",
      "credentialVersion",
      "challengeId",
      "nonce",
      "issuedAtMs",
      "expiresAtMs",
      "audience",
      "purpose",
    ]),
  "canonical field order changed",
);
assert(fixture.fields.protocol === "VPOD-AUTH/1", "protocol changed");
assert(fixture.fields.audience === "visepanda-device-api", "audience changed");
assert(fixture.fields.purpose === "device_session", "purpose changed");
assert(/^[1-9]\d*$/u.test(fixture.fields.credentialVersion), "invalid credential version");
assert(/^\d+$/u.test(fixture.fields.issuedAtMs), "invalid issuedAtMs");
assert(/^\d+$/u.test(fixture.fields.expiresAtMs), "invalid expiresAtMs");
assert(/^[A-Za-z0-9_-]+$/u.test(fixture.fields.nonce), "nonce is not unpadded base64url");
assert(/^[A-Za-z0-9_-]+$/u.test(fixture.signatureBase64Url), "signature is not unpadded base64url");
assert(fixture.expectedVerification === true, "positive vector must expect verification");

const canonical = canonicalize(fixture.fields, fixture.canonicalFieldOrder);
assert(
  canonical.toString("base64") === fixture.canonicalUtf8Base64,
  "canonical bytes do not match fixture",
);
assert(
  createHash("sha256").update(canonical).digest("hex") === fixture.canonicalSha256Hex,
  "canonical digest does not match fixture",
);

const signature = base64UrlToBuffer(fixture.signatureBase64Url);
const publicKey = createPublicKey(fixture.publicKeySpkiPem);
assert(publicKey.asymmetricKeyType === "rsa", "fixture key must be RSA");
assert(publicKey.asymmetricKeyDetails?.modulusLength === 2048, "fixture key must be RSA-2048");
assert(
  createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex") === fixture.publicKeySpkiSha256Hex,
  "public-key fingerprint does not match fixture",
);
const verified = verify(
  "sha256",
  canonical,
  {
    key: publicKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: fixture.saltLengthBytes,
  },
  signature,
);
assert(verified, "positive signature vector failed");

const altered = fixture.negativeCases.find((testCase) => testCase.id === "altered-device-id");
assert(altered, "altered-device-id negative vector is missing");
const alteredCanonical = canonicalize(
  { ...fixture.fields, [altered.mutation.field]: altered.mutation.value },
  fixture.canonicalFieldOrder,
);
assert(
  !verify(
    "sha256",
    alteredCanonical,
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: fixture.saltLengthBytes,
    },
    signature,
  ),
  "altered-message negative vector unexpectedly verified",
);

assert(
  Number(fixture.fields.expiresAtMs) - Number(fixture.fields.issuedAtMs) ===
    fixture.challengePolicy.ttlMs,
  "challenge TTL does not match signed fields",
);
assert(fixture.challengePolicy.nonceBytes === 32, "challenge nonce must be 32 bytes");
assert(base64UrlToBuffer(fixture.fields.nonce).length === 32, "fixture nonce is not 32 bytes");
assert(fixture.challengePolicy.consume === "atomic-once", "challenge must be one-time");
assert(fixture.challengePolicy.clockAuthority === "server", "device clock must not be trusted");

assert(fixture.tokenPolicy.opaqueTokenBytes === 32, "token must have 32 random bytes");
assert(fixture.tokenPolicy.storage === "sha256-digest-only", "raw tokens must not be stored");
assert(fixture.tokenPolicy.tokenTtlMs === 300_000, "token TTL must be 5 minutes");
assert(
  fixture.tokenPolicy.maxConnectedSessionMs === 900_000,
  "maximum connected session must be 15 minutes",
);
assert(
  JSON.stringify(fixture.tokenPolicy.scopes) === JSON.stringify(["device:session"]),
  "token scope expanded beyond device:session",
);
assert(fixture.tokenPolicy.refreshSupported === false, "P01 must not issue refresh tokens");

const expectedNegativeCodes = new Set([
  "DEVICE_SIGNATURE_INVALID",
  "DEVICE_CHALLENGE_EXPIRED",
  "DEVICE_CHALLENGE_REPLAYED",
  "DEVICE_REVOKED",
  "DEVICE_CREDENTIAL_REVOKED",
]);
assert(
  fixture.negativeCases.every((testCase) => expectedNegativeCodes.has(testCase.expectedCode)),
  "negative vector contains an unreviewed error code",
);
assert(
  fixture.revocationAssertions.outstandingChallengesDeleted === true &&
    fixture.revocationAssertions.activeSessionsDeleted === true &&
    fixture.revocationAssertions.activeTransportDisconnected === true &&
    fixture.revocationAssertions.statusOnlyRecoveryAllowed === false &&
    fixture.revocationAssertions.physicalReprovisionRequired === true,
  "revocation assertions are incomplete",
);

console.log(
  "VisePod auth vector passed: RSA-PSS signature, canonical bytes, expiry, scope, and revocation policy.",
);
