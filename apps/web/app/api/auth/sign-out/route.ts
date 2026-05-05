import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import {
  corsHeaders,
  isAllowedOrigin,
  parseCookieHeader,
  canonicalOrigin,
  requestOwnOrigin,
} from '@/lib/auth-cors-helpers';

/**
 * Cierra sesión Supabase en las cookies HTTP-only (misma sesión que `/api/auth/handoff`).
 * El portal debe llamar con `credentials: 'include'` y luego redirigir a `/portal/`.
 */
export async function OPTIONS(request: Request) {
  const origin = isAllowedOrigin(request, request.headers.get('origin'));
  if (!origin) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = isAllowedOrigin(request, request.headers.get('origin'));
  if (!origin) {
    return NextResponse.json({ error: 'Origin no permitido' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor' }, { status: 500, headers: corsHeaders(origin) });
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const response = NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });

  const originHeader = request.headers.get('origin');
  const ownOrigin = requestOwnOrigin(request);
  const originCanon = originHeader?.trim() ? canonicalOrigin(originHeader) : null;
  const isSameOrigin = Boolean(originCanon && ownOrigin && originCanon === ownOrigin);

  const cookieSecure = ownOrigin ? new URL(ownOrigin).protocol === 'https:' : true;
  const cookieSameSite: 'lax' | 'none' = isSameOrigin ? 'lax' : 'none';

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: { path: '/', sameSite: cookieSameSite, secure: cookieSecure },
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const base = (options ?? {}) as Parameters<typeof response.cookies.set>[2];
          const merged = {
            ...(typeof base === 'object' && base ? base : {}),
            sameSite: cookieSameSite,
            secure: cookieSecure,
          };
          response.cookies.set(name, value, merged);
        });
      },
    },
  });

  await supabase.auth.signOut();

  return response;
}
