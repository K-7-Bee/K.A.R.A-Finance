import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { isAuthPage, isPublicPath } from "@/lib/routes";

/**
 * Refresh the auth session on every request and enforce route access.
 * Uses getUser(), which verifies the token with Supabase Auth, rather than
 * trusting the cookie contents alone.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed session cookies onto the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !isPublicPath(path)) {
    const next = `${path}${request.nextUrl.search}`;
    return redirectTo("/sign-in", `?next=${encodeURIComponent(next)}`);
  }

  if (user && isAuthPage(path)) {
    return redirectTo("/overview");
  }

  return response;
}
