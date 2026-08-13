import {
  SeoEditorialOverrideMutationSchema,
  SeoPageIntentSchema,
  deriveSeoPageMatrix,
  type SeoPageCandidate,
  type SeoPageIntent,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { getKnowledgeService } from "../store";
import { getSeoEditorialOverrideService } from "./store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const selection = parseSelection(new URL(request.url).searchParams);
  if (!selection)
    return NextResponse.json({ error: "Expected poiId and intent." }, { status: 400 });

  const candidate = await findEligibleCandidate(selection);
  if (!candidate) {
    return applyOpsCookies(
      NextResponse.json(
        { error: "No current evidence-backed SEO candidate exists." },
        { status: 404 },
      ),
      authorization.cookieResponse,
    );
  }
  const override = await getSeoEditorialOverrideService().get(selection);
  return applyOpsCookies(NextResponse.json({ candidate, override }), authorization.cookieResponse);
}

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as Record<string, unknown>;
  const mutation = SeoEditorialOverrideMutationSchema.safeParse({
    poiId: body.poiId,
    intent: body.intent,
    title: textOrNull(body.title),
    summary: textOrNull(body.summary),
    emphasis: textOrNull(body.emphasis),
  });
  if (!mutation.success) {
    return NextResponse.json(
      { error: "Expected a POI, supported intent, and at least one bounded presentation field." },
      { status: 400 },
    );
  }

  const candidate = await findEligibleCandidate(mutation.data);
  if (!candidate) {
    return applyOpsCookies(
      NextResponse.json(
        { error: "No current evidence-backed SEO candidate exists." },
        { status: 409 },
      ),
      authorization.cookieResponse,
    );
  }

  try {
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "knowledge.seo_override.save.attempt",
      targetType: "poi",
      targetId: mutation.data.poiId,
      metadata: { intent: mutation.data.intent },
    });
    const override = await getSeoEditorialOverrideService().save({
      actorId: authorization.access.userId,
      ...mutation.data,
    });
    return applyOpsCookies(
      NextResponse.json({ candidate, override }),
      authorization.cookieResponse,
    );
  } catch (error) {
    return applyOpsCookies(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "SEO editorial override save failed." },
        { status: 400 },
      ),
      authorization.cookieResponse,
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const selection = parseSelection(new URL(request.url).searchParams);
  if (!selection)
    return NextResponse.json({ error: "Expected poiId and intent." }, { status: 400 });

  try {
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "knowledge.seo_override.delete.attempt",
      targetType: "poi",
      targetId: selection.poiId,
      metadata: { intent: selection.intent },
    });
    const removed = await getSeoEditorialOverrideService().delete({
      actorId: authorization.access.userId,
      ...selection,
    });
    return applyOpsCookies(NextResponse.json({ removed }), authorization.cookieResponse);
  } catch (error) {
    return applyOpsCookies(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "SEO editorial override delete failed." },
        { status: 400 },
      ),
      authorization.cookieResponse,
    );
  }
}

function parseSelection(params: URLSearchParams) {
  const poiId = params.get("poiId");
  const intent = SeoPageIntentSchema.safeParse(params.get("intent"));
  return poiId && intent.success ? { poiId, intent: intent.data } : null;
}

async function findEligibleCandidate(input: {
  poiId: string;
  intent: SeoPageIntent;
}): Promise<SeoPageCandidate | null> {
  const pois = await getKnowledgeService().listPois();
  return (
    deriveSeoPageMatrix(pois).pages.find(
      (candidate) => candidate.poiId === input.poiId && candidate.intent === input.intent,
    ) ?? null
  );
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
