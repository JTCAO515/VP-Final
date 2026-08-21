import { createHmac } from "node:crypto";
import { EarlyAccessSignupInputSchema, EarlyAccessSignupResultSchema } from "@visepanda/domain";
import { z } from "zod";
import { normalizeEarlyAccessUserAgent } from "./modules/earlyAccess/service.js";
import {
  getEarlyAccessConfirmationEmailSender,
  getEarlyAccessRateLimiter,
  getEarlyAccessSignupService,
  WebRuntimeUnavailableError,
} from "./webComposition.js";
import {
  TrustedClientAddressUnavailableError,
  resolveTrustedClientAddress,
} from "./webTrustedClient.js";

type Environment = Readonly<Record<string, string | undefined>>;

export class EarlyAccessIpHashUnavailableError extends Error {
  readonly code = "EARLY_ACCESS_IP_HASH_UNAVAILABLE";

  constructor() {
    super("Early Access IP hashing is unavailable.");
  }
}

export function hashEarlyAccessClientAddress(
  clientAddress: string,
  environment: Environment = process.env,
): string {
  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) throw new EarlyAccessIpHashUnavailableError();
  return createHmac("sha256", hashSalt).update(`early-access:${clientAddress}`).digest("hex");
}

const HoneypotSchema = z.object({ company: z.string().max(256).optional() }).passthrough();

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalidRequestResponse();
  }

  try {
    const honeypot = HoneypotSchema.safeParse(raw);
    if (!honeypot.success) return invalidRequestResponse();
    if (honeypot.data.company?.trim()) return successResponse("subscribed");

    const signup = EarlyAccessSignupInputSchema.safeParse(raw);
    if (!signup.success) return invalidRequestResponse();

    const clientAddress = resolveTrustedClientAddress(request.headers, process.env);
    const limiter = getEarlyAccessRateLimiter();
    if (!limiter) return unavailableResponse("EARLY_ACCESS_RATE_LIMIT_UNAVAILABLE");
    const admission = await limiter.check(clientAddress);
    if (!admission.allowed) {
      return Response.json(
        {
          ok: false,
          code: "EARLY_ACCESS_RATE_LIMITED",
          error: "Too many signup attempts were sent recently. Please try again later.",
          retryAfterSeconds: admission.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "retry-after": String(admission.retryAfterSeconds) },
        },
      );
    }

    const emailSender = getEarlyAccessConfirmationEmailSender();
    if (!emailSender) return confirmationUnavailableResponse();

    const userAgent = normalizeEarlyAccessUserAgent(request.headers.get("user-agent"));
    const result = await getEarlyAccessSignupService().submit(signup.data, {
      ipHash: hashEarlyAccessClientAddress(clientAddress),
      ...(userAgent ? { userAgent } : {}),
    });
    if (result.status === "subscribed") {
      try {
        await emailSender.send(signup.data);
      } catch {
        return confirmationUnavailableResponse(true);
      }
    }
    return successResponse(result.status);
  } catch (error) {
    if (
      error instanceof TrustedClientAddressUnavailableError ||
      error instanceof EarlyAccessIpHashUnavailableError ||
      error instanceof WebRuntimeUnavailableError
    ) {
      return unavailableResponse("EARLY_ACCESS_UNAVAILABLE");
    }
    return unavailableResponse("EARLY_ACCESS_UNAVAILABLE");
  }
}

function successResponse(status: "subscribed" | "already_subscribed"): Response {
  return Response.json({ ok: true, ...EarlyAccessSignupResultSchema.parse({ status }) });
}

function invalidRequestResponse(): Response {
  return Response.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
}

function unavailableResponse(code: string): Response {
  return Response.json(
    {
      ok: false,
      code,
      error: "Early Access signup is temporarily unavailable. Please try again later.",
    },
    { status: 503 },
  );
}

function confirmationUnavailableResponse(saved = false): Response {
  return Response.json(
    saved
      ? {
          ok: false,
          code: "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED",
          error: "Your Early Access signup was saved, but we could not send a confirmation email.",
        }
      : {
          ok: false,
          code: "EARLY_ACCESS_CONFIRMATION_UNAVAILABLE",
          error:
            "Early Access confirmation email is temporarily unavailable. Please try again later.",
        },
    { status: saved ? 502 : 503 },
  );
}
