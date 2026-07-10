import { CopilotEnvelopeSchema, TripStateSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../_server";
import { applyIdentityCookies, identityFields, resolveRequestIdentity } from "../../../lib/requestIdentity";

const CopilotRequestSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().uuid(),
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  currentTrip: TripStateSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CopilotRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(NextResponse.json({ ok: false, error: "Invalid Copilot request." }, { status: 400 }), cookieResponse);
  }

  try {
    const result = await getServerCaller(identity).copilot.run({ ...parsed.data, ...identityFields(identity) });
    const envelope = CopilotEnvelopeSchema.parse(result.envelope);
    const emptyDays = result.trip?.days.filter((day) => day.blocks.length === 0).length ?? 0;

    return applyIdentityCookies(NextResponse.json({
      ok: true,
      envelope,
      trip: result.trip,
      trace: result.trace,
      progress: {
        status: emptyDays > 0 ? "skeleton" : "completed",
        completedDays: (result.trip?.days.length ?? 0) - emptyDays,
        totalDays: result.trip?.days.length ?? 0,
        attempts: 0,
        error: null,
      },
    }), cookieResponse);
  } catch (error) {
    return applyIdentityCookies(NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Copilot request failed.",
      },
      { status: 502 },
    ), cookieResponse);
  }
}
