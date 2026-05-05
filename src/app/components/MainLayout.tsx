import { isLeadPortalRole, type PortalRole } from '@/lib/portalRole';
import { ReactNode, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Phone,
  Activity,
  Settings,
  Users,
  UsersRound,
  Hash,
  LogOut,
  ChevronDown,
  BarChart3,
  Circle,
  BookOpen,
} from 'lucide-react';
import { cn } from './ui/utils';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import logoThinkia from '../../imports/Logo_Thinkia_Light.svg';
import { PortalVoiceLayer } from './PortalVoiceLayer';
import {
  AgentPresenceProvider,
  useAgentPresence,
  type AgentPresenceUi,
} from '../context/AgentPresenceContext';
import { performPortalLogout } from '@/lib/portalLogout';

interface MainLayoutProps {
  children: ReactNode;
}

const ALL_MENU_ITEMS = [
  {
    icon: Phone,
    label: 'Centro de Llamadas',
    path: '/dashboard',
  },
  {
    icon: BookOpen,
    label: 'Contactos',
    path: '/contacts',
  },
  {
    icon: Hash,
    label: 'Números',
    path: '/numbers',
  },
  {
    icon: UsersRound,
    label: 'Usuarios y Equipos',
    path: '/teams',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    path: '/analytics',
  },
  {
    icon: Activity,
    label: 'Historial de llamadas',
    path: '/call-history',
  },
  {
    icon: Settings,
    label: 'Configuración',
    path: '/settings',
  },
];

function getStatusConfig(status: AgentPresenceUi) {
  switch (status) {
    case 'available':
      return {
        label: 'DISPONIBLE',
        borderColor: 'border-emerald-500',
        textColor: 'text-emerald-600',
        avatarBg: 'bg-emerald-100',
        avatarText: 'text-emerald-700',
        dotBg: 'bg-emerald-500',
      };
    case 'unavailable':
      return {
        label: 'NO DISPONIBLE',
        borderColor: 'border-red-500',
        textColor: 'text-red-600',
        avatarBg: 'bg-red-100',
        avatarText: 'text-red-700',
        dotBg: 'bg-red-500',
      };
    case 'do-not-disturb':
      return {
        label: 'NO MOLESTAR',
        borderColor: 'border-red-500',
        textColor: 'text-red-600',
        avatarBg: 'bg-red-100',
        avatarText: 'text-red-700',
        dotBg: 'bg-red-500',
      };
    case 'be-right-back':
      return {
        label: 'VUELVO ENSEGUIDA',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-600',
        avatarBg: 'bg-yellow-100',
        avatarText: 'text-yellow-800',
        dotBg: 'bg-yellow-500',
      };
    case 'appear-away':
      return {
        label: 'APARECER COMO AUSENTE',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-600',
        avatarBg: 'bg-yellow-100',
        avatarText: 'text-yellow-800',
        dotBg: 'bg-yellow-500',
      };
  }
}

function roleLabel(role: PortalRole): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'supervisor') return 'Supervisor';
  return 'Agente';
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, displayName, fullName, portalRole, presence, setPresence, avatarLetter, loading, error } =
    useAgentPresence();
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  const menuItems = useMemo(() => {
    if (isLeadPortalRole(portalRole)) return ALL_MENU_ITEMS;
    const agentPaths = new Set(['/dashboard', '/contacts', '/teams', '/call-history', '/analytics']);
    return ALL_MENU_ITEMS.filter((i) => agentPaths.has(i.path));
  }, [portalRole]);

  const isActivePath = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const currentStatusConfig = getStatusConfig(presence);
  /** Nombre visible: metadata Auth → display_name en agents → email. */
  const profileLabel = (fullName ?? displayName ?? email ?? '—').trim();

  return (
    <div className="size-full flex bg-background">
      <PortalVoiceLayer />
      {/* Main Sidebar */}
      <div className="w-64 min-w-64 border-r flex flex-col bg-white flex-shrink-0">
        {/* Logo */}
        <div className="h-20 flex items-center justify-center px-6 border-b">
          <img src={logoThinkia} alt="Thinkia" className="h-10" style={{ filter: 'invert(1) brightness(0.2)' }} />
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors rounded-xl mb-2',
                  isActive
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
              disabled={loading}
              className={cn(
                'w-full flex items-center gap-3 mb-4 px-3 py-3 bg-slate-50 rounded-lg border-l-4 hover:bg-slate-100 transition-colors cursor-pointer',
                currentStatusConfig.borderColor,
                loading && 'opacity-60 cursor-wait'
              )}
            >
              <div className="relative">
                <Avatar className={cn('h-10 w-10', currentStatusConfig.avatarBg)}>
                  <AvatarFallback className={cn(currentStatusConfig.avatarBg, currentStatusConfig.avatarText, 'text-sm font-semibold')}>
                    {avatarLetter}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                    currentStatusConfig.dotBg
                  )}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-900 truncate" title={profileLabel}>
                  {loading ? 'Cargando…' : profileLabel}
                </p>
                {!loading ? (
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{roleLabel(portalRole)}</p>
                ) : null}
                <p className={cn('text-xs font-semibold', currentStatusConfig.textColor)}>
                  {currentStatusConfig.label}
                </p>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isStatusMenuOpen ? 'rotate-180' : '')} />
            </button>

            {error ? <p className="mb-2 text-[11px] text-red-600 px-1">{error}</p> : null}

            {/* Status Menu Dropdown */}
            {isStatusMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsStatusMenuOpen(false)} />
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-xl border z-50 py-2">
                  <div className="px-3 py-2 border-b">
                    <p className="text-xs text-gray-500 font-medium uppercase">Estado</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void setPresence('available');
                      setIsStatusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    <Circle className="h-3 w-3 fill-current text-green-500" />
                    <span className="text-sm text-gray-900">Disponible</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setPresence('unavailable');
                      setIsStatusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    <Circle className="h-3 w-3 fill-current text-red-500" />
                    <span className="text-sm text-gray-900">No disponible</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setPresence('do-not-disturb');
                      setIsStatusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    <Circle className="h-3 w-3 fill-current text-red-500" />
                    <span className="text-sm text-gray-900">No molestar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setPresence('be-right-back');
                      setIsStatusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    <Circle className="h-3 w-3 fill-current text-yellow-500" />
                    <span className="text-sm text-gray-900">Vuelvo enseguida</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setPresence('appear-away');
                      setIsStatusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
                  >
                    <Circle className="h-3 w-3 fill-current text-yellow-500" />
                    <span className="text-sm text-gray-900">Aparecer como ausente</span>
                  </button>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm h-10 gap-2"
            type="button"
            onClick={() => void performPortalLogout()}
          >
            <LogOut className="h-4 w-4" />
            Finalizar Sesión
          </Button>
        </div>
      </div>

      {/* Main Content — overflow-auto para vistas largas (p. ej. Analytics con iframe). */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <AgentPresenceProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </AgentPresenceProvider>
  );
}
