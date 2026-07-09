import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";

const TripLookupSchema = z.object({
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const url = new URL(request.url);
  const parsed = TripLookupSchema.safeParse({
    anonId: url.searchParams.get("anonId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid trip lookup." }, { status: 400 });
  }

  const trip = await getServerCaller().trip.get({ id: tripId, ...parsed.data });
  if (!trip) return NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 });

  return NextResponse.json({ ok: true, trip });
}
