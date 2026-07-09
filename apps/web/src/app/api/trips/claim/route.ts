import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";

const ClaimRequestSchema = z.object({
  anonId: z.string().min(1),
  userId: z.string().uuid(),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  const parsed = ClaimRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid trip claim request." }, { status: 400 });
  }

  try {
    const result = await getServerCaller().trip.claimAnonymous(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Trip claim failed.",
      },
      { status: 502 },
    );
  }
}
