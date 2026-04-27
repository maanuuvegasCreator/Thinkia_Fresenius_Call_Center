/** Variables embebidas en el bundle en tiempo de build (`EXPO_PUBLIC_*`). */

export const EXPO_PUBLIC_SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const EXPO_PUBLIC_SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
export const EXPO_PUBLIC_NEXT_API_BASE = (process.env.EXPO_PUBLIC_NEXT_API_BASE ?? '').trim();

export const isSupabaseConfigured =
  EXPO_PUBLIC_SUPABASE_URL.length > 0 && EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 0;

const PLACEHOLDER_API = 'https://TU-PROYECTO-NEXT.vercel.app';

export function isNextApiBaseConfigured(): boolean {
  const b = EXPO_PUBLIC_NEXT_API_BASE.replace(/\/$/, '');
  return b.length > 0 && !b.includes('TU-PROYECTO');
}

export function getResolvedNextApiBase(): string {
  const b = EXPO_PUBLIC_NEXT_API_BASE.replace(/\/$/, '');
  return b.length > 0 ? b : PLACEHOLDER_API;
}
