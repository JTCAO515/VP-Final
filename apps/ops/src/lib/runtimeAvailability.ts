import { resolveRuntimeMode } from "@visepanda/app-server/runtime";
import { NextResponse } from "next/server";

export function pendingOpsCapabilityResponse(
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
