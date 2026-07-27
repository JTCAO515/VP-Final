import { after, NextResponse } from "next/server";
import { OutboundRedirectInputSchema } from "@visepanda/app-server";
import { getServerCaller } from "../api/_server";
import { runtimeUnavailableResponse } from "../api/_runtimeError";
import { applyIdentityCookies, resolveRequestIdentity } from "../../lib/requestIdentity";

export async function GET(request: Request) {
  const cookieResponse = NextResponse.next();
  try {
    const identity = await resolveRequestIdentity(request, cookieResponse);
    const params = new URL(request.url).searchParams;
    const partnerKey = params.get("partner");
    const targetUrl = params.get("url");
    if (!partnerKey || !targetUrl) {
      return applyIdentityCookies(
        NextResponse.json({ error: "Missing partner or url." }, { status: 400 }),
        cookieResponse,
      );
    }

    const input = OutboundRedirectInputSchema.safeParse({
      partnerKey,
      targetUrl,
      ...optionalFields(params),
    });
    if (!input.success) {
      return applyIdentityCookies(
        NextResponse.json({ error: "This partner destination is invalid." }, { status: 400 }),
        cookieResponse,
      );
    }
    const result = await getServerCaller(identity, after).commerce.createOutboundRedirect(
      input.data,
    );
    return applyIdentityCookies(NextResponse.redirect(result.redirectUrl, 302), cookieResponse);
  } catch (error) {
    const unavailable = runtimeUnavailableResponse(error);
    if (unavailable) return applyIdentityCookies(unavailable, cookieResponse);
    const code = errorCode(error);
    const status =
      code === "NOT_FOUND"
        ? 404
        : code === "BAD_REQUEST"
          ? 400
          : code === "UNAUTHORIZED"
            ? 401
            : code === "SERVICE_UNAVAILABLE"
              ? 503
              : 502;
    const message =
      status === 404
        ? "This partner link is unavailable."
        : status === 400
          ? "This partner destination is invalid."
          : status === 401
            ? "A valid session is required."
            : status === 503
              ? "Partner redirects are temporarily unavailable."
              : "This partner link is temporarily unavailable. No click was recorded.";
    return applyIdentityCookies(NextResponse.json({ error: message }, { status }), cookieResponse);
  }
}

function optionalFields(params: URLSearchParams) {
  return {
    ...(params.get("source") ? { source: params.get("source")! } : {}),
    ...(params.get("intent") ? { intent: params.get("intent")! } : {}),
    ...(params.get("entityId") ? { entityId: params.get("entityId")! } : {}),
  };
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}
