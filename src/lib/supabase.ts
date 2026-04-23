import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function getSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. En local: raíz del repo (.env). En Vercel (proyecto del login): Environment Variables con prefijo VITE_ y luego Redeploy sin caché para regenerar el build.'
    );
  }
  return createClient(url, anonKey);
}
