import { NextResponse } from "next/server";
import { WebRuntimeUnavailableError } from "./_server";
import { resolveRuntimeMode } from "@visepanda/app-server";

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

export function pendingDurableCapabilityResponse(
  capability: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NextResponse | null {
  const runtime = resolveRuntimeMode(environment);
  if (runtime.ok && (runtime.mode === "test" || runtime.mode === "local-demo")) return null;
  return NextResponse.json(
    {
      ok: false,
      code: "CAPABILITY_UNAVAILABLE",
      error: `${capability} is not available until its durable service is configured.`,
    },
    { status: 503 },
  );
}
