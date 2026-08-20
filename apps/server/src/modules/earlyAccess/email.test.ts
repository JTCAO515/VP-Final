import { describe, expect, it, vi } from "vitest";
import {
  EarlyAccessConfirmationEmailDeliveryError,
  EarlyAccessConfirmationEmailUnavailableError,
  createResendEarlyAccessConfirmationEmailSender,
  resolveEarlyAccessConfirmationEmailConfig,
} from "./email.js";

describe("Early Access Resend confirmation", () => {
  it("requires server-only key material and a safe verified sender shape", () => {
    expect(() => resolveEarlyAccessConfirmationEmailConfig({})).toThrow(
      EarlyAccessConfirmationEmailUnavailableError,
    );
    expect(() =>
      resolveEarlyAccessConfirmationEmailConfig({
        RESEND_API_KEY: "re_test",
        EARLY_ACCESS_EMAIL_FROM: "VisePanda <hello@example.com>\nBcc: other@example.com",
      }),
    ).toThrow(EarlyAccessConfirmationEmailUnavailableError);
  });

  it("sends a bounded confirmation without returning or persisting the provider result", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "provider-message-id" }, error: null });
    const sender = createResendEarlyAccessConfirmationEmailSender(
      { apiKey: "re_test", from: "VisePanda <hello@example.com>" },
      { emails: { send } },
    );

    await sender.send({ email: "traveler@example.com", locale: "en" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "VisePanda <hello@example.com>",
        to: ["traveler@example.com"],
        subject: "You are on the VisePanda Early Access list",
      }),
    );
    expect(JSON.stringify(send.mock.results)).not.toContain("re_test");
  });

  it("normalizes every provider failure to a safe delivery error", async () => {
    const sender = createResendEarlyAccessConfirmationEmailSender(
      { apiKey: "re_test", from: "VisePanda <hello@example.com>" },
      { emails: { send: vi.fn().mockResolvedValue({ data: null, error: { name: "provider" } }) } },
    );

    await expect(
      sender.send({ email: "traveler@example.com", locale: "en" }),
    ).rejects.toBeInstanceOf(EarlyAccessConfirmationEmailDeliveryError);
  });
});
