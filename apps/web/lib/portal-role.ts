import type { SupabaseClient } from '@supabase/supabase-js';

export type PortalRole = 'agent' | 'supervisor' | 'admin';

export function normalizePortalRole(raw: string | null | undefined): PortalRole {
  const s = (raw ?? 'agent').toLowerCase().trim();
  if (s === 'admin' || s === 'supervisor' || s === 'agent') return s;
  return 'agent';
}

export function isLeadPortalRole(role: PortalRole): boolean {
  return role === 'admin' || role === 'supervisor';
}

/**
 * Lee `agents.portal_role` con el cliente de sesión (RLS: fila propia).
 */
export async function getPortalRoleForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PortalRole> {
  const { data, error } = await supabase
    .from('agents')
    .select('portal_role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return 'agent';
  }
  return normalizePortalRole((data as { portal_role?: string }).portal_role);
}
