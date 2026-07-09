import { NextResponse } from "next/server";
import { OutboundClickSchema, buildOutboundUrl } from "@visepanda/domain";
import { recordOutboundClick } from "./ledger";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const partner = params.get("partner");
  const targetUrl = params.get("url");
  if (!partner || !targetUrl) {
    return NextResponse.json({ error: "Missing partner or url." }, { status: 400 });
  }

  try {
    const click = OutboundClickSchema.parse({
      id: crypto.randomUUID(),
      partner,
      targetUrl,
      source: value(params.get("source")),
      intent: value(params.get("intent")),
      entityId: value(params.get("entityId")),
      createdAt: new Date().toISOString(),
    });
    const redirectUrl = buildOutboundUrl({ partnerKey: partner, targetUrl, clickId: click.id });
    recordOutboundClick(click);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid outbound URL." },
      { status: 400 },
    );
  }
}

function value(input: string | null): string | undefined {
  return input ?? undefined;
}
