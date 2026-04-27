import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

/** Valores alineados con el selector del sidebar (MainLayout). */
export type AgentPresenceUi =
  | 'available'
  | 'unavailable'
  | 'do-not-disturb'
  | 'be-right-back'
  | 'appear-away';

type DbPresence =
  | 'available'
  | 'unavailable'
  | 'do_not_disturb'
  | 'be_right_back'
  | 'appear_away';

function toDb(ui: AgentPresenceUi): DbPresence {
  switch (ui) {
    case 'do-not-disturb':
      return 'do_not_disturb';
    case 'be-right-back':
      return 'be_right_back';
    case 'appear-away':
      return 'appear_away';
    default:
      return ui;
  }
}

function fromDb(db: string): AgentPresenceUi {
  switch (db) {
    case 'available':
      return 'available';
    case 'unavailable':
      return 'unavailable';
    case 'do_not_disturb':
      return 'do-not-disturb';
    case 'be_right_back':
      return 'be-right-back';
    case 'appear_away':
      return 'appear-away';
    default:
      return 'unavailable';
  }
}

export type AgentPresenceContextValue = {
  email: string | null;
  displayName: string | null;
  presence: AgentPresenceUi;
  setPresence: (next: AgentPresenceUi) => Promise<void>;
  /** Solo en `available` el Voice SDK muestra el modal de entrante. */
  acceptsIncomingCalls: boolean;
  avatarLetter: string;
  loading: boolean;
  error: string | null;
};

const AgentPresenceContext = createContext<AgentPresenceContextValue | null>(null);

export function AgentPresenceProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [presence, setPresenceState] = useState<AgentPresenceUi>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setEmail(null);
        setUserId(null);
        setDisplayName(null);
        setPresenceState('available');
        return;
      }
      setEmail(session.user.email ?? null);
      setUserId(session.user.id);

      const { data: row, error: agErr } = await supabase
        .from('agents')
        .select('display_name, presence_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (agErr) {
        setError(agErr.message);
        setDisplayName(null);
        return;
      }

      if (!row) {
        setError('No hay fila en public.agents para este usuario (¿migración / trigger?)');
        setDisplayName(null);
        return;
      }

      setDisplayName(row.display_name ?? null);
      if (typeof row.presence_status === 'string' && row.presence_status) {
        setPresenceState(fromDb(row.presence_status));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar agente');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPresence = useCallback(
    async (next: AgentPresenceUi) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      const { error: upErr } = await supabase
        .from('agents')
        .update({ presence_status: toDb(next) })
        .eq('user_id', userId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setError(null);
      setPresenceState(next);
    },
    [userId]
  );

  /**
   * Hasta terminar la carga no aceptamos entrantes (evita race con el valor por defecto).
   * Si falla la lectura de `agents`, no mostramos popup (desconocemos presencia real).
   */
  const acceptsIncomingCalls =
    Boolean(userId) && !loading && error == null && presence === 'available';

  const avatarLetter = useMemo(() => {
    const n = (displayName ?? email ?? '?').trim();
    return n.length ? n.charAt(0).toUpperCase() : '?';
  }, [displayName, email]);

  const value = useMemo<AgentPresenceContextValue>(
    () => ({
      email,
      displayName,
      presence,
      setPresence,
      acceptsIncomingCalls,
      avatarLetter,
      loading,
      error,
    }),
    [email, displayName, presence, setPresence, acceptsIncomingCalls, avatarLetter, loading, error]
  );

  return <AgentPresenceContext.Provider value={value}>{children}</AgentPresenceContext.Provider>;
}

export function useAgentPresence(): AgentPresenceContextValue {
  const v = useContext(AgentPresenceContext);
  if (!v) {
    throw new Error('useAgentPresence debe usarse dentro de AgentPresenceProvider');
  }
  return v;
}
