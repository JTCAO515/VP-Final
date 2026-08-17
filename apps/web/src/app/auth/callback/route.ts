import { NextResponse } from "next/server";
import {
  configuredPasswordRecoveryRedirect,
  issuePasswordRecoveryProof,
  protectRecoveryResponse,
} from "../../../lib/passwordRecovery";
import { applyIdentityCookies } from "../../../lib/requestIdentity";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

function recoveryRedirect(request: Request, state: "1" | "failed") {
  const destination = new URL("/account", request.url);
  destination.searchParams.set("recovery", state);
  return protectRecoveryResponse(NextResponse.redirect(destination));
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code || code.length > 4096) return recoveryRedirect(request, "failed");

  try {
    configuredPasswordRecoveryRedirect(request);
    const cookieResponse = NextResponse.next();
    const supabase = createSupabaseServerClient(request, cookieResponse);
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) return recoveryRedirect(request, "failed");

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return recoveryRedirect(request, "failed");

    const response = recoveryRedirect(request, "1");
    applyIdentityCookies(response, cookieResponse);
    issuePasswordRecoveryProof(response, data.user.id);
    return response;
  } catch {
    return recoveryRedirect(request, "failed");
  }
}
