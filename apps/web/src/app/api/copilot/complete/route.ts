import { CompletionJobRetryInputSchema, CompletionJobSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";
import { runtimeUnavailableResponse } from "../../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

const CompleteRequestSchema = z.object({
  tripId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

const CompletionStatusRequestSchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CompletionStatusRequestSchema.safeParse({
    id: new URL(request.url).searchParams.get("id"),
  });
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json(
        { ok: false, error: "Invalid completion status request." },
        { status: 400 },
      ),
      cookieResponse,
    );
  }

  try {
    const job = await getServerCaller(identity).copilot.completionStatus(parsed.data);
    const response = job
      ? NextResponse.json({ ok: true, job: CompletionJobSchema.parse(job) })
      : NextResponse.json({ ok: false, error: "Completion job not found." }, { status: 404 });
    return applyIdentityCookies(response, cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Completion status is unavailable." }, { status: 503 }),
      cookieResponse,
    );
  }
}

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
    const job = CompletionJobSchema.parse(await caller.copilot.completeTrip(parsed.data));

    return applyIdentityCookies(
      NextResponse.json({
        ok: true,
        job,
      }),
      cookieResponse,
    );
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Trip completion could not be queued.",
        },
        { status: 503 },
      ),
      cookieResponse,
    );
  }
}

export async function PATCH(request: Request) {
  const cookieResponse = NextResponse.next();
  const identity = await resolveRequestIdentity(request, cookieResponse);
  const parsed = CompletionJobRetryInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Invalid completion retry request." }, { status: 400 }),
      cookieResponse,
    );
  }

  try {
    const job = await getServerCaller(identity).copilot.retryCompletion(parsed.data);
    const response = job
      ? NextResponse.json({ ok: true, job: CompletionJobSchema.parse(job) })
      : NextResponse.json({ ok: false, error: "Completion cannot be retried." }, { status: 404 });
    return applyIdentityCookies(response, cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    return applyIdentityCookies(
      NextResponse.json({ ok: false, error: "Completion retry is unavailable." }, { status: 503 }),
      cookieResponse,
    );
  }
}
