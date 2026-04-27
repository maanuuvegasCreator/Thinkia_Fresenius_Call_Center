import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolvePortalLoginUrl } from '@/lib/portal-login-url';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Login — Thinkia',
};

/** El login real está en el portal Vite (`/portal` embebido o URL externa); aquí solo redirigimos. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const requestOrigin = host ? `${proto}://${host}` : 'http://localhost:3000';
  const u = resolvePortalLoginUrl({
    requestOrigin,
    explicit: process.env.NEXT_PUBLIC_VITE_LOGIN_URL,
  });
  if (host && searchParams.next?.startsWith('/')) {
    u.searchParams.set('postLoginRedirect', `${proto}://${host}${searchParams.next}`);
  }
  redirect(u.toString());
}
