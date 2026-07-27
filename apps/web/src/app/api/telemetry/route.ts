import { TelemetryCaptureInputSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { getServerCaller } from "../_server";
import { runtimeUnavailableResponse } from "../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../lib/requestIdentity";

export async function POST(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const parsed = TelemetryCaptureInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return applyIdentityCookies(
        NextResponse.json({ ok: false, error: "Invalid telemetry event." }, { status: 400 }),
        cookieResponse,
      );
    }

    await getServerCaller(identity).telemetry.track(parsed.data);
    return applyIdentityCookies(NextResponse.json({ ok: true }, { status: 202 }), cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    console.warn("telemetry_capture_failed", { failureClass: "persistence_error" });
    return applyIdentityCookies(
      NextResponse.json(
        { ok: false, error: "Telemetry is temporarily unavailable." },
        { status: 503 },
      ),
      cookieResponse,
    );
  }
}
