import { NextResponse } from "next/server";
import { HumanTaskStatusSchema } from "@visepanda/domain";
import { listTasks, updateTask } from "./store";

export function GET() {
  return NextResponse.json(listTasks());
}

export async function PATCH(request: Request) {
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
    return NextResponse.json(
      updateTask({
        id: body.id,
        status: status.success ? status.data : undefined,
        price_usd:
          typeof body.price_usd === "number" || body.price_usd === null
            ? body.price_usd
            : undefined,
        payment_link:
          typeof body.payment_link === "string" || body.payment_link === null
            ? body.payment_link
            : undefined,
        operator_note:
          typeof body.operator_note === "string" || body.operator_note === null
            ? body.operator_note
            : undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update task." },
      { status: 400 },
    );
  }
}
