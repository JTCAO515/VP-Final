import { GenerationProgressSchema, TripStateSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";
import {
  applyIdentityCookies,
  identityFields,
  resolveRequestIdentity,
} from "../../../../lib/requestIdentity";

const CompleteRequestSchema = z.object({
  tripId: z.string().uuid(),
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
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
    const input = { ...parsed.data, ...identityFields(identity) };
    const progress = GenerationProgressSchema.parse(await caller.copilot.completeTrip(input));
    const trip = TripStateSchema.nullable().parse(
      await caller.trip.get({ ...input, id: input.tripId }),
    );

    return applyIdentityCookies(NextResponse.json({ ok: true, progress, trip }), cookieResponse);
  } catch (error) {
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Trip completion failed.",
        },
        { status: 502 },
      ),
      cookieResponse,
    );
  }
}
