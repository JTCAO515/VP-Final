import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getServerCaller } from "../../_server";
import { listMobileTrips } from "../../../../lib/mobileTripAccess";

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: "Trip sync is temporarily unavailable." },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const result = await listMobileTrips(request.headers.get("authorization"), {
    async getUser(accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      return error || !data.user
        ? null
        : { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) };
    },
    listTrips(identity) {
      return getServerCaller(identity).trip.list();
    },
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
