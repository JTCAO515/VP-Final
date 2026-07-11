import { GenerationProgressSchema } from "@visepanda/domain";
import { TripVersionConflictError } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

const CompleteRequestSchema = z.object({
  tripId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CompleteRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid completion request." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const caller = getServerCaller(identity);
    const progress = GenerationProgressSchema.parse(await caller.copilot.completeTrip(parsed.data));
    const snapshot = await caller.trip.get({ id: parsed.data.tripId });

    return applyIdentityCookies(
      NextResponse.json({
        ok: true,
        progress,
        trip: snapshot?.trip ?? null,
        version: snapshot?.version ?? null,
      }),
      cookieResponse,
    );
  } catch (error) {
    const conflict = findTripConflict(error);
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error: conflict
            ? "This trip changed before detail completion finished. Reload it before retrying."
            : error instanceof Error
              ? error.message
              : "Trip completion failed.",
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
