import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';
import { canAccessPath, type PortalRole } from '@/lib/portalRole';
import { useAgentPresence } from '../context/AgentPresenceContext';

type Props = {
  children: React.ReactNode;
};

/**
 * Redirige a /dashboard si el rol no puede acceder a la ruta actual (p. ej. agente → Analytics).
 */
export function PortalRouteGuard({ children }: Props) {
  const { portalRole, loading } = useAgentPresence();
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && !loading && !canAccessPath(portalRole as PortalRole, location.pathname)) {
      console.info('[portal] Ruta no permitida para el rol actual:', location.pathname);
    }
  }, [loading, portalRole, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Cargando permisos…
      </div>
    );
  }

  if (!canAccessPath(portalRole as PortalRole, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
