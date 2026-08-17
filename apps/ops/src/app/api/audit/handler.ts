import { type OpsAuditFilters } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../lib/opsAccess";

type Dependencies = {
  authorize: (
    request: Request,
    permission: "membership.read",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
};

const defaults: Dependencies = { authorize: authorizeOpsRequest };

export async function handleAuditLedgerGet(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  const authorization = await dependencies.authorize(request, "membership.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const events = await authorization.authorizationService.listAudit(
      authorization.access,
      filtersFromUrl(new URL(request.url)),
    );
    return applyOpsCookies(NextResponse.json({ ok: true, events }), authorization.cookieResponse);
  } catch (error) {
    const status = error instanceof ZodError || error instanceof SyntaxError ? 400 : 503;
    return applyOpsCookies(
      NextResponse.json(
        {
          ok: false,
          error:
            status === 400
              ? "请输入精确的审计筛选条件，时间范围不得超过 90 天。"
              : "审计记录暂时不可用，请稍后重试。",
        },
        { status },
      ),
      authorization.cookieResponse,
    );
  }
}

function filtersFromUrl(url: URL): OpsAuditFilters {
  return {
    action: url.searchParams.get("action") ?? undefined,
    actorId: url.searchParams.get("actorId") ?? undefined,
    from: dateParam(url.searchParams.get("from")),
    limit: numberParam(url.searchParams.get("limit")),
    to: dateParam(url.searchParams.get("to")),
  };
}

function dateParam(value: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

function numberParam(value: string | null): number | undefined {
  return value ? Number(value) : undefined;
}
