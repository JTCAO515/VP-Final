import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../../_server";

const ShareRequestSchema = z.object({
  anonId: z.string().min(1).optional(),
  userId: z.string().uuid().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const parsed = ShareRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid share request." }, { status: 400 });
  }

  const result = await getServerCaller().trip.createShareToken({ id: tripId, ...parsed.data });
  if (!result) {
    return NextResponse.json({ ok: false, error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    token: result.token,
    url: `/share/trips/${encodeURIComponent(result.token)}`,
  });
}
