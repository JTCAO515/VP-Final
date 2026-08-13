import {
  HumanTaskReceiptSchema,
  HumanTaskSubmissionSchema,
  type HumanTaskCreate,
  type HumanTaskReceipt,
} from "@visepanda/domain";

export type MobileHumanHelpErrorCode =
  | "MOBILE_HUMAN_HELP_UNAVAILABLE"
  | "MOBILE_HUMAN_HELP_SESSION_INVALID"
  | "MOBILE_HUMAN_HELP_REJECTED";

export class MobileHumanHelpError extends Error {
  constructor(
    readonly code: MobileHumanHelpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MobileHumanHelpError";
  }
}

export async function submitMobileHumanHelp(input: {
  accessToken: string;
  baseUrl: string;
  request: HumanTaskCreate;
  idempotencyKey?: string;
  fetcher?: typeof fetch;
}): Promise<HumanTaskReceipt> {
  const fetcher = input.fetcher ?? fetch;
  const submission = HumanTaskSubmissionSchema.parse({
    ...input.request,
    idempotency_key: input.idempotencyKey ?? createMobileHumanHelpIdempotencyKey(),
  });

  let response: Response;
  try {
    response = await fetcher(`${input.baseUrl.replace(/\/$/, "")}/api/mobile/human-help`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(submission),
    });
  } catch {
    throw new MobileHumanHelpError(
      "MOBILE_HUMAN_HELP_UNAVAILABLE",
      "Human Help is temporarily unavailable. Your request was not submitted.",
    );
  }

  const payload = await readJson(response);
  if (response.status === 401) {
    throw new MobileHumanHelpError(
      "MOBILE_HUMAN_HELP_SESSION_INVALID",
      "Your sign-in session has expired. Sign in again before requesting Human Help.",
    );
  }
  if (!response.ok) {
    throw new MobileHumanHelpError(
      response.status === 400 || response.status === 409 || response.status === 429
        ? "MOBILE_HUMAN_HELP_REJECTED"
        : "MOBILE_HUMAN_HELP_UNAVAILABLE",
      readError(payload) ??
        "Human Help is temporarily unavailable. Your request was not submitted.",
    );
  }

  const parsed = HumanTaskReceiptSchema.safeParse(
    payload && typeof payload === "object" && "task" in payload ? payload.task : null,
  );
  if (!parsed.success) {
    throw new MobileHumanHelpError(
      "MOBILE_HUMAN_HELP_UNAVAILABLE",
      "Human Help returned an invalid receipt. Your request was not confirmed.",
    );
  }
  return parsed.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readError(payload: unknown): string | null {
  return payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : null;
}

export function createMobileHumanHelpIdempotencyKey(random = Math.random): string {
  const values = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  values[6] = (values[6]! & 0x0f) | 0x40;
  values[8] = (values[8]! & 0x3f) | 0x80;
  const hex = values.map((value) => value!.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
