import { HumanTaskReceiptSchema, HumanTaskSubmissionSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { getServerCaller } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();

  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const parsed = HumanTaskSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return applyIdentityCookies(
        NextResponse.json({ ok: false, error: "Invalid Human Help request." }, { status: 400 }),
        cookieResponse,
      );
    }

    const task = await getServerCaller(identity).task.create(parsed.data);
    return applyIdentityCookies(
      NextResponse.json({ ok: true, task: HumanTaskReceiptSchema.parse(task) }),
      cookieResponse,
    );
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    const code = errorCode(error);
    const status =
      code === "TOO_MANY_REQUESTS"
        ? 429
        : code === "CONFLICT"
          ? 409
          : code === "BAD_REQUEST"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : 502;
    const message =
      status === 429
        ? "The Shanghai preview queue is full for today. Please try again tomorrow."
        : status === 409
          ? "This request could not be safely retried. Start a new request."
          : status === 400
            ? "Human Help is currently available only for the Shanghai preview."
            : status === 401
              ? "A valid session is required."
              : "Human Help is temporarily unavailable. Your request was not submitted.";
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: message }, { status }),
      cookieResponse,
    );
  }
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}
