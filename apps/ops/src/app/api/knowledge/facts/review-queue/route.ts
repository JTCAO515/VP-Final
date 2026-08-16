import { DraftFactReviewQueueFilterSchema } from "@visepanda/domain";
import { NextResponse } from "next/server";
import { getKnowledgeService } from "../../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../../lib/opsAccess";

const FILTER_KEYS = new Set(["poiId", "factType", "importBatchId"]);

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  const filter = parseFilter(request.url);
  if (!filter.success) {
    return applyOpsCookies(
      NextResponse.json({ error: filter.error }, { status: 400 }),
      authorization.cookieResponse,
    );
  }

  try {
    const items = await getKnowledgeService().listDraftFactReviewQueue(filter.data);
    return applyOpsCookies(NextResponse.json({ items }), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(
      NextResponse.json({ error: "Draft fact review queue is unavailable." }, { status: 503 }),
      authorization.cookieResponse,
    );
  }
}

function parseFilter(
  url: string,
):
  | { success: true; data: ReturnType<typeof DraftFactReviewQueueFilterSchema.parse> }
  | { success: false; error: string } {
  const search = new URL(url).searchParams;
  for (const key of search.keys()) {
    if (!FILTER_KEYS.has(key)) return { success: false, error: `Unexpected filter: ${key}.` };
  }
  const parsed = DraftFactReviewQueueFilterSchema.safeParse({
    ...(search.has("poiId") ? { poiId: search.get("poiId") } : {}),
    ...(search.has("factType") ? { factType: search.get("factType") } : {}),
    ...(search.has("importBatchId") ? { importBatchId: search.get("importBatchId") } : {}),
  });
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") };
}
