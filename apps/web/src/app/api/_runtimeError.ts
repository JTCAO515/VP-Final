import { NextResponse } from "next/server";
import { WebRuntimeUnavailableError } from "./_server";

export function runtimeUnavailableResponse(error: unknown): NextResponse | null {
  if (!(error instanceof WebRuntimeUnavailableError)) return null;
  return NextResponse.json(
    {
      ok: false,
      code: error.code,
      error: "VisePanda is temporarily unavailable because durable services are not configured.",
    },
    { status: 503 },
  );
}
