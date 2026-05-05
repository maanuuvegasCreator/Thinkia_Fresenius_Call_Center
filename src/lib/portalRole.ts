export type PortalRole = 'agent' | 'supervisor' | 'admin';

export function parsePortalRole(raw: string | null | undefined): PortalRole {
  const s = (raw ?? 'agent').toLowerCase().trim();
  if (s === 'admin' || s === 'supervisor' || s === 'agent') return s;
  return 'agent';
}

export function isLeadPortalRole(role: PortalRole): boolean {
  return role === 'admin' || role === 'supervisor';
}

/** Rutas solo para supervisor/admin. Agentes: /teams y /numbers en solo lectura. Analytics: vista propia vía API. */
const LEAD_PREFIXES = ['/settings', '/monitoring', '/activity', '/team-directory'];

export function canAccessPath(portalRole: PortalRole, pathname: string): boolean {
  if (!isLeadPortalRole(portalRole)) {
    return !LEAD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return true;
}
