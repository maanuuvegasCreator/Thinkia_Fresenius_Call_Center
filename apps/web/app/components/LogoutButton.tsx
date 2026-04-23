'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useState } from 'react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* ignorar */
    } finally {
      const vite = process.env.NEXT_PUBLIC_VITE_LOGIN_URL ?? 'http://localhost:5173';
      window.location.href = vite;
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
    >
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
