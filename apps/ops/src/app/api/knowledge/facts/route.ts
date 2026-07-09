import { NextResponse } from "next/server";
import { updateFact } from "../store";

export async function PATCH(request: Request) {
  const body = (await request.json()) as { factId?: unknown; value?: unknown };
  if (typeof body.factId !== "string" || !isRecord(body.value)) {
    return NextResponse.json({ error: "Expected factId and object value." }, { status: 400 });
  }

  return NextResponse.json(updateFact(body.factId, body.value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
