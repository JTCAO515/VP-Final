import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";
import { readCookie } from "./requestIdentity";

export function createSupabaseServerClient(request: Request, response: NextResponse) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Authentication is not configured.");

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
    const [name] = part.trim().split("=");
    const value = name ? readCookie(header, name) : undefined;
    return name && value !== undefined ? [{ name, value }] : [];
  });
}
