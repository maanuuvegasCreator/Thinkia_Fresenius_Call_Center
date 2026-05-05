import { getSupabaseBrowserClient } from '@/lib/supabase';
import { clearSupabaseBrowserStorageOnly } from '@/lib/clearSupabaseLocalStorage';

/**
 * Cierra sesión en cookies Next (`/api/auth/sign-out`), cliente Supabase y localStorage;
 * redirige a la pantalla de login del portal (`base` de Vite = `/portal/`).
 */
export async function performPortalLogout(): Promise<void> {
  try {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    /* seguir con limpieza local */
  }

  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  } catch {
    /* noop */
  }

  clearSupabaseBrowserStorageOnly();

  const base = import.meta.env.BASE_URL || '/portal/';
  const loginHref = new URL(base, window.location.origin).href;
  window.location.replace(loginHref);
}
