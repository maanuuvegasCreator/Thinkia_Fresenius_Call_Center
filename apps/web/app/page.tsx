import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LogoutButton } from './components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const explicitLogin = process.env.NEXT_PUBLIC_VITE_LOGIN_URL?.trim();
  const onVercel = process.env.VERCEL === '1';
  const portalMisconfiguredOnProd =
    onVercel &&
    typeof explicitLogin === 'string' &&
    (explicitLogin.includes('localhost') || explicitLogin.includes('127.0.0.1'));
  let userEmail: string | null = null;
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (hasSupabaseEnv) {
    try {
      const supabase = createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    } catch {
      userEmail = null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-50 px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Thinkia — Web (C1/C2)</h1>
        <p className="mt-2 text-neutral-600">
          Next.js + Supabase Auth + Twilio Voice. El softphone requiere sesión.
        </p>
        {portalMisconfiguredOnProd ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            En Vercel, <code className="rounded bg-red-100 px-1">NEXT_PUBLIC_VITE_LOGIN_URL</code> apunta a
            localhost. En despliegue único el login vive en <code className="rounded bg-red-100 px-1">/portal/</code>:
            borra esa variable o pon una URL absoluta válida (o una ruta que empiece por <code className="rounded bg-red-100 px-1">/</code>
            ) y vuelve a desplegar.
          </p>
        ) : null}
        {!hasSupabaseEnv ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Configura <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            {onVercel ? (
              <>
                {' '}
                en Vercel → proyecto → <strong>Settings</strong> → <strong>Environment Variables</strong> (Production
                y/o Preview), guarda y vuelve a desplegar.
              </>
            ) : (
              <>
                {' '}
                en <code className="rounded bg-amber-100 px-1">apps/web/.env</code> para activar login.
              </>
            )}
          </p>
        ) : userEmail ? (
          <p className="mt-4 text-sm text-neutral-700">
            Sesión: <span className="font-medium">{userEmail}</span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-neutral-600">No hay sesión activa.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/softphone"
          className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700"
        >
          Abrir softphone
        </Link>
        {!userEmail ? (
          portalMisconfiguredOnProd ? (
            <span className="cursor-not-allowed rounded-xl border border-neutral-200 bg-neutral-100 px-6 py-3 text-sm font-semibold text-neutral-400">
              Iniciar sesión
            </span>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Iniciar sesión
            </Link>
          )
        ) : (
          <LogoutButton />
        )}
      </div>
    </main>
  );
}
