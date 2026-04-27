import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Alineado con `apps/web/lib/agent-presence.ts` y PATCH `/api/agents/presence`. */
export type AgentPresenceUi =
  | 'available'
  | 'unavailable'
  | 'do-not-disturb'
  | 'be-right-back'
  | 'appear-away';

type AgentsMeJson = {
  error?: string;
  userId?: string;
  email?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  presence?: AgentPresenceUi;
};

async function fetchAgentsMe(): Promise<AgentsMeJson> {
  const res = await fetch('/api/agents/me', { credentials: 'include', cache: 'no-store' });
  const j = (await res.json().catch(() => ({}))) as AgentsMeJson;
  if (!res.ok) {
    return { error: j.error ?? `HTTP ${res.status}` };
  }
  return j;
}

async function patchPresence(presence: AgentPresenceUi): Promise<{ ok: true } | { error: string }> {
  const res = await fetch('/api/agents/presence', {
    method: 'PATCH',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presence }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { error: j.error ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

export type AgentPresenceContextValue = {
  email: string | null;
  /** Nombre legible (metadata Supabase o agents). */
  fullName: string | null;
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
  const [fullName, setFullName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [presence, setPresenceState] = useState<AgentPresenceUi>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentsMe();
      if (data.error) {
        setError(data.error);
        setEmail(null);
        setFullName(null);
        setDisplayName(null);
        setUserId(null);
        setPresenceState('available');
        return;
      }
      setUserId(data.userId ?? null);
      setEmail(data.email ?? null);
      setFullName(data.fullName ?? null);
      setDisplayName(data.displayName ?? null);
      if (data.presence) {
        setPresenceState(data.presence);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar agente');
      setEmail(null);
      setFullName(null);
      setDisplayName(null);
      setUserId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPresence = useCallback(async (next: AgentPresenceUi) => {
    if (!userId) {
      setError('Sesión no lista. Recarga la página o vuelve a entrar.');
      return;
    }
    const result = await patchPresence(next);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setPresenceState(next);
  }, [userId]);

  /**
   * Hasta terminar la carga no aceptamos entrantes (evita race con el valor por defecto).
   * Si falla la lectura, no mostramos popup.
   */
  const acceptsIncomingCalls =
    Boolean(userId) && !loading && error == null && presence === 'available';

  const avatarLetter = useMemo(() => {
    const label = (fullName ?? displayName ?? email ?? '?').trim();
    return label.length ? label.charAt(0).toUpperCase() : '?';
  }, [fullName, displayName, email]);

  const value = useMemo<AgentPresenceContextValue>(
    () => ({
      email,
      fullName,
      displayName,
      presence,
      setPresence,
      acceptsIncomingCalls,
      avatarLetter,
      loading,
      error,
    }),
    [email, fullName, displayName, presence, setPresence, acceptsIncomingCalls, avatarLetter, loading, error]
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
