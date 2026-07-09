import { GenerationProgressSchema, TripStateSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";

const CompleteRequestSchema = z.object({
  tripId: z.string().uuid(),
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  const parsed = CompleteRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid completion request." }, { status: 400 });
  }

  try {
    const caller = getServerCaller();
    const progress = GenerationProgressSchema.parse(await caller.copilot.completeTrip(parsed.data));
    const trip = TripStateSchema.nullable().parse(
      await caller.trip.get({ ...parsed.data, id: parsed.data.tripId }),
    );

    return NextResponse.json({ ok: true, progress, trip });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Trip completion failed.",
      },
      { status: 502 },
    );
  }
}
