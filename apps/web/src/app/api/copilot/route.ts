import { CopilotEnvelopeSchema } from "@visepanda/domain";
import { TripVersionConflictError } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";
import { findModelFailure, summarizeModelFailure } from "./modelFailure";

const CopilotRequestSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().uuid().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CopilotRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid Copilot request." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const result = await getServerCaller(identity).copilot.run(parsed.data);
    const envelope = CopilotEnvelopeSchema.parse(result.envelope);
    const emptyDays = result.trip?.days.filter((day) => day.blocks.length === 0).length ?? 0;

    return applyIdentityCookies(
      NextResponse.json({
        ok: true,
        envelope,
        trip: result.trip,
        version: result.version,
        trace: result.trace,
        progress: {
          status: emptyDays > 0 ? "skeleton" : "completed",
          completedDays: (result.trip?.days.length ?? 0) - emptyDays,
          totalDays: result.trip?.days.length ?? 0,
          attempts: 0,
          error: null,
        },
      }),
      cookieResponse,
    );
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    const modelFailure = findModelFailure(error);
    if (modelFailure) {
      const diagnostic = summarizeModelFailure(error);
      if (diagnostic) console.warn("copilot_model_provider_failure", diagnostic);
      return applyIdentityCookies(
        NextResponse.json(
          {
            ok: false,
            code: modelFailure.code,
            error:
              modelFailure.code === "MODEL_CONFIGURATION_UNAVAILABLE"
                ? "Copilot is unavailable because its model provider configuration is incomplete."
                : "Copilot is temporarily unavailable because its model providers could not respond.",
          },
          { status: 503 },
        ),
        cookieResponse,
      );
    }
    const conflict = findTripConflict(error);
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error: conflict
            ? "This trip changed in another session. Reload it before trying again."
            : error instanceof Error
              ? error.message
              : "Copilot request failed.",
          ...(conflict ? { code: conflict.code, currentVersion: conflict.currentVersion } : {}),
        },
        { status: conflict ? 409 : 502 },
      ),
      cookieResponse,
    );
  }
}

function findTripConflict(error: unknown): TripVersionConflictError | null {
  if (error instanceof TripVersionConflictError) return error;
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof TripVersionConflictError) return cause;
  }
  return null;
}
