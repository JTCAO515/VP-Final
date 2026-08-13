import { HumanTaskStatusSchema, type HumanTask } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerCaller } from "../../_server";
import { runtimeUnavailableResponse } from "../../_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../../../lib/requestIdentity";

const TravelerHumanTaskSchema = z
  .object({
    id: z.string().min(1),
    status: HumanTaskStatusSchema,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    price_usd: z.number().nonnegative().nullable(),
    payment_link: z.string().url().nullable(),
  })
  .strict();

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    if (identity.kind === "none") {
      return applyIdentityCookies(
        NextResponse.json(
          { ok: false, error: "A valid session is required." },
          { status: 401, headers: { "cache-control": "private, no-store" } },
        ),
        cookieResponse,
      );
    }
    const tasks = await getServerCaller(identity).task.listMine();
    return applyIdentityCookies(
      NextResponse.json(
        {
          ok: true,
          tasks: tasks.map(projectTravelerTask),
        },
        { headers: { "cache-control": "private, no-store" } },
      ),
      cookieResponse,
    );
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) {
      unavailable.headers.set("cache-control", "private, no-store");
      return applyIdentityCookies(unavailable, cookieResponse);
    }
    return applyIdentityCookies(
      NextResponse.json(
        { ok: false, error: "Human Help requests are temporarily unavailable." },
        { status: 503, headers: { "cache-control": "private, no-store" } },
      ),
      cookieResponse,
    );
  }
}

function projectTravelerTask(task: HumanTask) {
  return TravelerHumanTaskSchema.parse({
    id: task.id,
    status: task.status,
    created_at: task.created_at,
    updated_at: task.updated_at,
    price_usd: task.status === "payment_pending" ? task.price_usd : null,
    payment_link: task.status === "payment_pending" ? task.payment_link : null,
  });
}
