import { createClient } from '@supabase/supabase-js';

/** Solo servidor (webhooks Twilio, etc.). Nunca importar en Client Components. AICONCTATC-84 */
export function createSupabaseServiceRoleClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL');
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new Error(
      `Faltan en el servidor Next (p. ej. Vercel → proyecto Next, no solo el portal): ${missing.join(', ')}`
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
