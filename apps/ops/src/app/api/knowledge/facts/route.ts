import { NextResponse } from "next/server";
import { getKnowledgeService } from "../store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    poiId?: unknown;
    factType?: unknown;
    value?: unknown;
    confidence?: unknown;
    source?: unknown;
    expiresAt?: unknown;
  };
  if (
    typeof body.poiId !== "string" ||
    typeof body.factType !== "string" ||
    !isRecord(body.value) ||
    typeof body.confidence !== "number" ||
    typeof body.source !== "string"
  ) {
    return NextResponse.json(
      { error: "Expected poiId, factType, value, confidence, and source." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await getKnowledgeService().createFact({
        poiId: body.poiId,
        factType: body.factType,
        value: body.value,
        confidence: body.confidence,
        source: body.source,
        ...(typeof body.expiresAt === "string" || body.expiresAt === null
          ? { expiresAt: body.expiresAt }
          : {}),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fact create failed." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    factId?: unknown;
    value?: unknown;
    confidence?: unknown;
    source?: unknown;
    expiresAt?: unknown;
    action?: unknown;
  };
  if (
    typeof body.factId !== "string" ||
    (body.action !== "renew" && body.action !== "deprecate" && !isRecord(body.value))
  ) {
    return NextResponse.json({ error: "Expected factId and object value." }, { status: 400 });
  }

  try {
    const service = getKnowledgeService();
    if (body.action === "renew") {
      return NextResponse.json(
        await service.renewFact({
          factId: body.factId,
          ...(typeof body.expiresAt === "string" || body.expiresAt === null
            ? { expiresAt: body.expiresAt }
            : {}),
        }),
      );
    }
    if (body.action === "deprecate") {
      return NextResponse.json(await service.deprecateFact({ factId: body.factId }));
    }
    if (!isRecord(body.value)) {
      return NextResponse.json({ error: "Expected object value." }, { status: 400 });
    }
    return NextResponse.json(
      await service.updateFact({
        factId: body.factId,
        value: body.value,
        ...(typeof body.confidence === "number" ? { confidence: body.confidence } : {}),
        ...(typeof body.source === "string" ? { source: body.source } : {}),
        ...(typeof body.expiresAt === "string" || body.expiresAt === null
          ? { expiresAt: body.expiresAt }
          : {}),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fact update failed." },
      { status: 400 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
