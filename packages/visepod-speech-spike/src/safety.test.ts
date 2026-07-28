import { describe, expect, it } from "vitest";

import { loadDashScopeExperimentConfig, sanitizeDiagnostic, SpeechSpikeError } from "./safety.js";

describe("speech spike safety", () => {
  it("fails honestly when provider configuration is absent", () => {
    expect(() => loadDashScopeExperimentConfig({})).toThrowError(
      expect.objectContaining<Partial<SpeechSpikeError>>({
        code: "SPEECH_PROVIDER_NOT_CONFIGURED",
      }),
    );
  });

  it("never returns credential, cookie, or signature text in diagnostics", () => {
    const unstructuredSecret = "provider-secret-without-known-prefix";
    const message = sanitizeDiagnostic(
      `Bearer secret-token api_key=secret-two cookie=session-three signature=four ${unstructuredSecret}`,
      [unstructuredSecret],
    );
    expect(message).not.toContain("secret-token");
    expect(message).not.toContain("secret-two");
    expect(message).not.toContain("session-three");
    expect(message).not.toContain("four");
    expect(message).not.toContain(unstructuredSecret);
    expect(message.match(/\[REDACTED\]/g)?.length).toBe(5);
  });

  it("removes local fixture paths from persisted diagnostics", () => {
    expect(sanitizeDiagnostic("ENOENT /Users/example/private-fixtures/sample.wav")).toBe(
      "ENOENT [REDACTED]",
    );
  });
});
