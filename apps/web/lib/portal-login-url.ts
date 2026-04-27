/**
 * URL del portal de login (Vite).
 * - Un solo Vercel: no definas `NEXT_PUBLIC_VITE_LOGIN_URL` → `/portal/` en el mismo host que Next.
 * - Legacy (segundo despliegue): `NEXT_PUBLIC_VITE_LOGIN_URL=https://otro-dominio...`
 */
export function resolvePortalLoginUrl(opts: {
  requestOrigin: string;
  explicit?: string | null;
}): URL {
  const raw = opts.explicit?.trim() ?? '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/';
    }
    return u;
  }
  if (raw.startsWith('/')) {
    const path = raw.endsWith('/') ? raw : `${raw}/`;
    return new URL(path, opts.requestOrigin);
  }
  return new URL('/portal/', opts.requestOrigin);
}
