import { CompletionDeliverySchema, createCompletionProcessor } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { getCompletionCallbackRuntime } from "../../../_server";
import { runtimeUnavailableResponse } from "../../../_runtimeError";

export const maxDuration = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const runtime = getCompletionCallbackRuntime();
    const signature = request.headers.get("upstash-signature") ?? "";
    if (!(await runtime.completionQueue.verify(rawBody, signature))) {
      return NextResponse.json(
        { ok: false, error: "Invalid delivery signature." },
        { status: 401 },
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid delivery body." }, { status: 400 });
    }
    const parsed = CompletionDeliverySchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid delivery body." }, { status: 400 });
    }

    const result = await createCompletionProcessor({
      completeDay: runtime.completionDay,
      jobService: runtime.completionJobService,
      queue: runtime.completionQueue,
      tripService: runtime.tripService,
    }).process(parsed.data);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return unavailable;
    return NextResponse.json(
      { ok: false, error: "Trip completion delivery failed." },
      { status: 500 },
    );
  }
}
