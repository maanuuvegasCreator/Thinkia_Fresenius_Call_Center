import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * La app principal vive en el SPA Vite bajo `/portal/` (ver `vercel.json` rewrites).
 * La raíz del dominio solo redirige allí; con sesión Supabase (cookies) se va al dashboard.
 */
export default async function Home() {
  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  if (hasEnv) {
    try {
      const supabase = createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect('/portal/dashboard');
      }
    } catch {
      /* sin sesión o error: portal login */
    }
  }

  redirect('/portal/');
}
