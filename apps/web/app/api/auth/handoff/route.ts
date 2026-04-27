import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(';').map((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return { name: part.trim(), value: '' };
    return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
  });
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  };
}

function canonicalOrigin(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

function requestOwnOrigin(request: Request): string | null {
  const host = request.headers.get('host') ?? '';
  if (!host) return null;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

/** Compara por origin canónico (tolera barra final o path en la env). */
function isAllowedOrigin(request: Request, originHeader: string | null): string | null {
  if (!originHeader) return null;
  const requestCanon = canonicalOrigin(originHeader);
  if (!requestCanon) return null;

  const own = requestOwnOrigin(request);
  if (own && own === requestCanon) {
    return originHeader.trim();
  }

  const raw = process.env.AUTH_HANDOFF_ALLOWED_ORIGIN ?? 'http://localhost:5173';
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const allowCanon = canonicalOrigin(entry);
    if (allowCanon && allowCanon === requestCanon) {
      return originHeader.trim();
    }
  }
  return null;
}

/**
 * Tras login en la app Vite, copia la sesión Supabase a cookies del dominio Next (softphone /api/token).
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { access_token, refresh_token } = body as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Faltan access_token o refresh_token' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor' }, { status: 500 });
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  let response = NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });

  /** Sin esto, el navegador no guarda Set-Cookie en un fetch cross-site (Vite → Next) y /softphone vuelve al login. */
  const crossSiteCookies =
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: crossSiteCookies
      ? { path: '/', sameSite: 'none', secure: true }
      : { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const base = (options ?? {}) as Parameters<typeof response.cookies.set>[2];
          const merged = crossSiteCookies
            ? { ...(typeof base === 'object' && base ? base : {}), sameSite: 'none' as const, secure: true }
            : base;
          response.cookies.set(name, value, merged);
        });
      },
    },
  });

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401, headers: corsHeaders(origin) });
  }

  return response;
}
