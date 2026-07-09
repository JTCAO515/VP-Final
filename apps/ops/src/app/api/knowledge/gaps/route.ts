import { NextResponse } from "next/server";
import { getKnowledgeService } from "../store";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return NextResponse.json(
    await getKnowledgeService().listGaps(
      status === "open" || status === "resolved" || status === "ignored" ? { status } : {},
    ),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: unknown; city?: unknown };
  if (typeof body.question !== "string") {
    return NextResponse.json({ error: "Expected question." }, { status: 400 });
  }

  return NextResponse.json(
    await getKnowledgeService().recordGap({
      question: body.question,
      ...(typeof body.city === "string" && body.city ? { city: body.city } : {}),
    }),
  );
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    gapId?: unknown;
    status?: unknown;
    resolutionTarget?: unknown;
  };
  if (
    typeof body.gapId !== "string" ||
    (body.status !== "open" && body.status !== "resolved" && body.status !== "ignored")
  ) {
    return NextResponse.json({ error: "Expected gapId and status." }, { status: 400 });
  }

  const result = await getKnowledgeService().updateGap({
    gapId: body.gapId,
    status: body.status,
    ...(isResolutionTarget(body.resolutionTarget)
      ? { resolutionTarget: body.resolutionTarget }
      : {}),
  });

  if (!result) return NextResponse.json({ error: "Gap not found." }, { status: 404 });
  return NextResponse.json(result);
}

function isResolutionTarget(value: unknown): value is { kind: "poi_fact" | "guide"; id: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; id?: unknown };
  return (
    (candidate.kind === "poi_fact" || candidate.kind === "guide") &&
    typeof candidate.id === "string"
  );
}
