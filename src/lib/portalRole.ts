export type PortalRole = 'agent' | 'supervisor' | 'admin';

export function parsePortalRole(raw: string | null | undefined): PortalRole {
  const s = (raw ?? 'agent').toLowerCase().trim();
  if (s === 'admin' || s === 'supervisor' || s === 'agent') return s;
  return 'agent';
}

export function isLeadPortalRole(role: PortalRole): boolean {
  return role === 'admin' || role === 'supervisor';
}

/** Rutas solo para supervisor/admin (menú y guard). Analytics la ven también los agentes (vista propia vía API). */
const LEAD_PREFIXES = ['/numbers', '/teams', '/settings', '/monitoring', '/activity', '/team-directory'];

export function canAccessPath(portalRole: PortalRole, pathname: string): boolean {
  if (!isLeadPortalRole(portalRole)) {
    return !LEAD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return true;
}
