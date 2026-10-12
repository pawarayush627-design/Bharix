
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  // Only allow relative redirects to prevent open redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/?error=auth_code_missing", url.origin));
  }

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL("/?error=supabase_not_configured", url.origin)
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        items: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[]
      ) {
        items.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/?error=auth_callback_failed", url.origin)
    );
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
