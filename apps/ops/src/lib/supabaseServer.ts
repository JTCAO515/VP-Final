import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";

export function createOpsSupabaseRequestClient(request: Request, response: NextResponse) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Ops authentication is not configured.");

  return createServerClient(url, key, {
    cookies: {
      getAll: () => parseCookies(request.headers.get("cookie")),
      setAll: (cookies) =>
        cookies.forEach((cookie) =>
          response.cookies.set(cookie.name, cookie.value, cookie.options),
        ),
    },
  });
}

function parseCookies(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(";").flatMap((part) => {
    const [name, ...rest] = part.trim().split("=");
    return name ? [{ name, value: rest.join("=") }] : [];
  });
}
