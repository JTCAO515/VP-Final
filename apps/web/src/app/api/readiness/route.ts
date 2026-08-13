import {
  ChinaReadinessPersistenceRequestSchema,
  ChinaReadinessSavedAssessmentSchema,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";

const LatestReadinessQuerySchema = z.object({ tripId: z.string().uuid().optional() }).strict();

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  const query = LatestReadinessQuerySchema.safeParse({
    tripId: new URL(request.url).searchParams.get("tripId") ?? undefined,
  });
  if (!query.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid readiness request." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const saved = await getServerCaller(identity).readiness.latest(
      query.data.tripId ? { tripId: query.data.tripId } : undefined,
    );
    return applyIdentityCookies(
      NextResponse.json({
        ok: true,
        assessment: saved ? ChinaReadinessSavedAssessmentSchema.parse(saved) : null,
      }),
      cookieResponse,
    );
  } catch (error) {
    return readinessErrorResponse(error, cookieResponse);
  }
}

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const parsed = ChinaReadinessPersistenceRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error:
            "Choose the fixed readiness answers and explicitly agree before saving this self-report.",
        },
        { status: 400 },
      ),
      cookieResponse,
    );
  }

  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const saved = await getServerCaller(identity).readiness.save(parsed.data);
    return applyIdentityCookies(
      NextResponse.json({ ok: true, assessment: ChinaReadinessSavedAssessmentSchema.parse(saved) }),
      cookieResponse,
    );
  } catch (error) {
    return readinessErrorResponse(error, cookieResponse);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readinessErrorResponse(error: unknown, cookieResponse: NextResponse): NextResponse {
  const unavailable = runtimeUnavailableResponse(error);
  if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);

  const code = errorCode(error);
  const status =
    code === "UNAUTHORIZED"
      ? 401
      : code === "BAD_REQUEST" || code === "READINESS_TRIP_REQUIRED"
        ? 400
        : code === "READINESS_TRIP_NOT_FOUND"
          ? 404
          : 502;
  const message =
    code === "UNAUTHORIZED"
      ? "A valid session is required to save readiness information."
      : code === "READINESS_TRIP_REQUIRED"
        ? "Save this self-report to your current Trip, or sign in before saving it."
        : code === "READINESS_TRIP_NOT_FOUND"
          ? "The selected Trip is unavailable. Your self-report was not saved."
          : status === 400
            ? "This readiness self-report could not be saved. Check your selection and try again."
            : "Readiness is temporarily unavailable. Your self-report was not saved.";
  return applyIdentityCookies(
    NextResponse.json({ ok: false, error: message }, { status }),
    cookieResponse,
  );
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("cause" in error) {
    const nested = errorCode(error.cause);
    if (nested) return nested;
  }
  return "code" in error && typeof error.code === "string" ? error.code : null;
}
