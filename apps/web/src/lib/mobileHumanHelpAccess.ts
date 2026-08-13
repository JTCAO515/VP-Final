import {
  HumanTaskReceiptSchema,
  HumanTaskSubmissionSchema,
  type HumanTaskReceipt,
  type HumanTaskSubmission,
} from "@visepanda/domain";

export type MobileHumanHelpVerifiedUser = { id: string; email?: string };

export type MobileHumanHelpResult =
  | { ok: true; task: HumanTaskReceipt }
  | { ok: false; status: 400 | 401 | 409 | 429 | 503; error: string };

/**
 * Native clients cannot rely on the browser's signed anonymous cookie. This boundary verifies a
 * Supabase bearer token online and always creates a task for that authenticated owner.
 */
export async function submitMobileHumanHelp(
  authorization: string | null,
  input: unknown,
  dependencies: {
    getUser(accessToken: string): Promise<MobileHumanHelpVerifiedUser | null>;
    submit(
      identity: { kind: "authenticated"; userId: string; email?: string },
      request: HumanTaskSubmission,
    ): Promise<HumanTaskReceipt>;
  },
): Promise<MobileHumanHelpResult> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return failure(401, "Sign in is required to request Human Help.");

  const parsed = HumanTaskSubmissionSchema.safeParse(input);
  if (!parsed.success) return failure(400, "Invalid Human Help request.");

  let user: MobileHumanHelpVerifiedUser | null;
  try {
    user = await dependencies.getUser(accessToken);
  } catch {
    return failure(503, "Human Help is temporarily unavailable. Your request was not submitted.");
  }
  if (!user) return failure(401, "Your mobile session is no longer valid.");

  try {
    return {
      ok: true,
      task: HumanTaskReceiptSchema.parse(await dependencies.submit(identityFor(user), parsed.data)),
    };
  } catch (error) {
    return mapSubmissionFailure(error);
  }
}

function identityFor(user: MobileHumanHelpVerifiedUser) {
  return {
    kind: "authenticated" as const,
    userId: user.id,
    ...(user.email ? { email: user.email } : {}),
  };
}

function mapSubmissionFailure(error: unknown): Extract<MobileHumanHelpResult, { ok: false }> {
  const code = errorCode(error);
  const causeCode = nestedErrorCode(error);
  if (code === "TOO_MANY_REQUESTS") {
    return causeCode === "HUMAN_TASK_IDENTITY_CAPACITY_REACHED"
      ? failure(
          429,
          "Human Help accepts one new request per verified traveler each China day. Please try again tomorrow.",
        )
      : failure(429, "The Shanghai preview queue is full for today. Please try again tomorrow.");
  }
  if (code === "CONFLICT")
    return failure(409, "This request could not be safely retried. Start a new request.");
  if (code === "BAD_REQUEST")
    return failure(400, "Human Help is currently available only for the Shanghai preview.");
  if (code === "UNAUTHORIZED") return failure(401, "Your mobile session is no longer valid.");
  return failure(503, "Human Help is temporarily unavailable. Your request was not submitted.");
}

function failure(status: 400 | 401 | 409 | 429 | 503, error: string) {
  return { ok: false as const, status, error };
}

function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

function nestedErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("cause" in error) {
    const nested = nestedErrorCode(error.cause);
    if (nested) return nested;
  }
  return errorCode(error);
}

function readBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]{20,})$/);
  return match?.[1] ?? null;
}
