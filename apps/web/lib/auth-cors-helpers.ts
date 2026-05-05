import type { NextRequest } from 'next/server';

export function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(';').map((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return { name: part.trim(), value: '' };
    return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
  });
}

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  };
}

export function canonicalOrigin(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

export function requestOwnOrigin(request: Request | NextRequest): string | null {
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

/** Misma lógica que handoff: mismo host o `AUTH_HANDOFF_ALLOWED_ORIGIN`. */
export function isAllowedOrigin(request: Request, originHeader: string | null): string | null {
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
