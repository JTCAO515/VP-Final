import { describe, expect, it } from "vitest";
import {
  PASSWORD_RECOVERY_PROOF_MAX_AGE_SECONDS,
  createPasswordRecoveryProof,
  parsePasswordRecoveryProof,
} from "./passwordRecovery";

const secret = "password-recovery-test-secret-with-at-least-32-characters";

describe("password recovery proof", () => {
  it("accepts a recent proof only for its signed user", () => {
    const proof = createPasswordRecoveryProof("user-123", secret, 1_000);

    expect(parsePasswordRecoveryProof(proof, secret, 1_010)).toEqual({ userId: "user-123" });
    expect(
      parsePasswordRecoveryProof(
        proof,
        secret,
        1_000 + PASSWORD_RECOVERY_PROOF_MAX_AGE_SECONDS + 1,
      ),
    ).toBeNull();
  });

  it("rejects a proof with a changed user, timestamp, or signature", () => {
    const proof = createPasswordRecoveryProof("user-123", secret, 1_000);

    expect(
      parsePasswordRecoveryProof(proof.replace("user-123", "user-456"), secret, 1_010),
    ).toBeNull();
    expect(parsePasswordRecoveryProof(proof.replace(".1000.", ".1001."), secret, 1_010)).toBeNull();
    expect(parsePasswordRecoveryProof(`${proof}x`, secret, 1_010)).toBeNull();
  });
});
