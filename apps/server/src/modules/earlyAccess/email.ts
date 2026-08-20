import type { EarlyAccessSignupInput } from "@visepanda/domain";
import { Resend } from "resend";
import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;

const SenderSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine(
    (value) => !/[\r\n]/.test(value) && /<[^<>\s@]+@[^<>\s@]+>$/.test(value),
    "A verified Resend sender address is required.",
  );

export type EarlyAccessConfirmationEmailSender = {
  send(input: Pick<EarlyAccessSignupInput, "email" | "locale">): Promise<void>;
};

export type EarlyAccessConfirmationEmailConfig = {
  apiKey: string;
  from: string;
};

type ResendEmailClient = {
  emails: {
    send(input: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    }): Promise<{ data: unknown; error: unknown }>;
  };
};

export class EarlyAccessConfirmationEmailUnavailableError extends Error {
  readonly code = "EARLY_ACCESS_CONFIRMATION_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Early Access confirmation email is unavailable.");
  }
}

export class EarlyAccessConfirmationEmailDeliveryError extends Error {
  readonly code = "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED";

  constructor() {
    super("Early Access confirmation email delivery failed.");
  }
}

export function resolveEarlyAccessConfirmationEmailConfig(
  environment: Environment,
): EarlyAccessConfirmationEmailConfig {
  const apiKey = environment.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EarlyAccessConfirmationEmailUnavailableError("api_key_missing");

  const parsedFrom = SenderSchema.safeParse(environment.EARLY_ACCESS_EMAIL_FROM);
  if (!parsedFrom.success) {
    throw new EarlyAccessConfirmationEmailUnavailableError("sender_invalid");
  }
  return { apiKey, from: parsedFrom.data };
}

export function createResendEarlyAccessConfirmationEmailSender(
  config: EarlyAccessConfirmationEmailConfig,
  client: ResendEmailClient = new Resend(config.apiKey),
): EarlyAccessConfirmationEmailSender {
  return {
    async send(input) {
      const result = await client.emails.send({
        from: config.from,
        to: [input.email],
        subject: "You are on the VisePanda Early Access list",
        html: confirmationHtml(),
        text: confirmationText(),
      });
      if (result.error) throw new EarlyAccessConfirmationEmailDeliveryError();
    },
  };
}

export function createInMemoryEarlyAccessConfirmationEmailSender(): EarlyAccessConfirmationEmailSender {
  return { send: async () => undefined };
}

function confirmationText(): string {
  return [
    "You are on the VisePanda Early Access list.",
    "VisePanda is the AI planning and execution workspace for independent travel in China.",
    "We will contact you when access or a material preview update is ready.",
    "VisePanda does not handle bookings, payments, or emergencies.",
  ].join("\n\n");
}

function confirmationHtml(): string {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f8f5f0;color:#1d1a17;font-family:Georgia,serif"><main style="max-width:560px;margin:0 auto;padding:48px 24px"><p style="margin:0 0 20px;color:#aa271f;font:600 12px/1.4 Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase">VisePanda</p><h1 style="margin:0 0 20px;font-size:32px;line-height:1.15">You are on the Early Access list.</h1><p style="font:18px/1.6 Arial,sans-serif">VisePanda is the AI planning and execution workspace for independent travel in China.</p><p style="font:16px/1.6 Arial,sans-serif">We will contact you when access or a material preview update is ready.</p><p style="color:#625b53;font:14px/1.6 Arial,sans-serif">VisePanda does not handle bookings, payments, or emergencies.</p></main></body></html>`;
}
