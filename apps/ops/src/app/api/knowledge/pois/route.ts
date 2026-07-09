import { NextResponse } from "next/server";
import { getKnowledgeService } from "../store";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city");
  return NextResponse.json(
    await getKnowledgeService().listPois({
      ...(city ? { city } : {}),
      includeExpired: params.get("includeExpired") === "1",
      includeDeprecated: params.get("includeDeprecated") === "1",
    }),
  );
}
