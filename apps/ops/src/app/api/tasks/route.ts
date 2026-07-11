import { NextResponse } from "next/server";
import { HumanTaskStatusSchema } from "@visepanda/domain";
import { listTasks, updateTask } from "./store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "task.contact.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  return applyOpsCookies(NextResponse.json(listTasks()), authorization.cookieResponse);
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "task.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as {
    id?: unknown;
    status?: unknown;
    price_usd?: unknown;
    payment_link?: unknown;
    operator_note?: unknown;
  };

  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "Expected task id." }, { status: 400 });
  }

  try {
    const status = HumanTaskStatusSchema.safeParse(body.status);
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "human_task.update.attempt",
      targetType: "human_task",
      targetId: body.id,
    });
    const result = updateTask({
      id: body.id,
      status: status.success ? status.data : undefined,
      price_usd:
        typeof body.price_usd === "number" || body.price_usd === null ? body.price_usd : undefined,
      payment_link:
        typeof body.payment_link === "string" || body.payment_link === null
          ? body.payment_link
          : undefined,
      operator_note:
        typeof body.operator_note === "string" || body.operator_note === null
          ? body.operator_note
          : undefined,
    });
    return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update task." },
      { status: 400 },
    );
  }
}
