import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Login — Thinkia',
};

/** El login real está en la app Vite (misma UI de siempre); aquí solo redirigimos. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const vite = process.env.NEXT_PUBLIC_VITE_LOGIN_URL ?? 'http://localhost:5173';
  const u = new URL(vite);
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (host && searchParams.next?.startsWith('/')) {
    u.searchParams.set('postLoginRedirect', `${proto}://${host}${searchParams.next}`);
  }
  redirect(u.toString());
}
