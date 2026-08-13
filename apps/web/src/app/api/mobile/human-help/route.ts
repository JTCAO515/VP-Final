import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getServerCaller } from "../../_server";
import { submitMobileHumanHelp } from "../../../../lib/mobileHumanHelpAccess";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return unavailable();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid Human Help request." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const result = await submitMobileHumanHelp(request.headers.get("authorization"), payload, {
    async getUser(accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      return error || !data.user
        ? null
        : { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) };
    },
    submit(identity, task) {
      return getServerCaller(identity).task.create(task);
    },
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}

function unavailable() {
  return NextResponse.json(
    { ok: false, error: "Human Help is temporarily unavailable. Your request was not submitted." },
    { status: 503 },
  );
}
