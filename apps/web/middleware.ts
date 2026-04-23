import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}

/**
 * Refresco de sesión Supabase + protección de /softphone (AICONCTATC-85).
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith('/softphone') && !user) {
    const viteBase = process.env.NEXT_PUBLIC_VITE_LOGIN_URL ?? 'http://localhost:5173';
    const u = new URL(viteBase);
    const returnUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
    u.searchParams.set('postLoginRedirect', returnUrl);
    const redirect = NextResponse.redirect(u);
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if (path === '/login' && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.delete('next');
    const redirect = NextResponse.redirect(redirectUrl);
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/', '/softphone/:path*', '/login', '/auth/callback'],
};
