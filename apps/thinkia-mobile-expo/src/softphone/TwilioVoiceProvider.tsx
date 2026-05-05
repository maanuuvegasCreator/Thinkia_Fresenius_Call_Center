import type { Session } from '@supabase/supabase-js';
import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';
import { COMPANY_LABEL, DEMO_CONTACTS, SEED_CALL_LOG } from './demoData';
import { supabase } from '../lib/supabase';
import { fetchTwilioAccessToken, isNextApiBaseConfigured } from '../lib/twilioToken';
import { formatClock } from './twilioFormat';
import type { CallLogDirection, CallLogEntry, TwilioVoiceContextValue } from './twilioTypes';

const TwilioVoiceContext = createContext<TwilioVoiceContextValue | null>(null);

function contactNameForPhone(phone: string, fallback: string): string {
  const norm = phone.replace(/\s/g, '');
  const hit = DEMO_CONTACTS.find((c) => c.phone.replace(/\s/g, '') === norm);
  return hit?.name ?? fallback;
}

type Props = { session: Session; children: ReactNode };

export function TwilioVoiceProvider({ session, children }: Props) {
  const voiceRef = useRef<Voice | null>(null);
  const twilioJwtRef = useRef<string | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const lastOutgoingMetaRef = useRef<{ to: string } | null>(null);

  const [registering, setRegistering] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [statusLine, setStatusLine] = useState('Inicializando…');
  const [digits, setDigits] = useState('');
  const [incoming, setIncoming] = useState<CallInvite | null>(null);
  const [active, setActive] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);
  const [outgoingBusy, setOutgoingBusy] = useState(false);
  const [activeCallLabel, setActiveCallLabel] = useState('');
  const [activeCallNumber, setActiveCallNumber] = useState('');
  const [callElapsedSec, setCallElapsedSec] = useState(0);
  const [callUiPhase, setCallUiPhase] = useState<'idle' | 'dialing' | 'ringing' | 'connected'>('idle');
  const [callLog, setCallLog] = useState<CallLogEntry[]>(() => [...SEED_CALL_LOG]);
  const [callsFilter, setCallsFilter] = useState<'all' | 'missed'>('all');

  const appendCallLog = useCallback(
    (direction: CallLogDirection, name: string, phone: string, durationSec?: number) => {
      const entry: CallLogEntry = {
        id: `c-${Date.now()}`,
        direction,
        name,
        phone,
        time: formatClock(),
        durationSec,
      };
      setCallLog((prev) => [entry, ...prev]);
    },
    []
  );

  const attachCall = useCallback(
    (call: Call, meta: { direction: 'in' | 'out'; remoteNumber: string; remoteName: string }) => {
      activeCallRef.current = call;
      setActive(call);
      setMuted(Boolean(call.isMuted()));
      setActiveCallLabel(meta.remoteName);
      setActiveCallNumber(meta.remoteNumber);
      connectedAtRef.current = null;
      setCallElapsedSec(0);
      setCallUiPhase(meta.direction === 'out' ? 'dialing' : 'connected');

      call.on(Call.Event.Connected, () => {
        setCallUiPhase('connected');
        connectedAtRef.current = Date.now();
        setStatusLine('En llamada');
      });
      call.on(Call.Event.Ringing, () => {
        setCallUiPhase('ringing');
        setStatusLine('Sonando…');
      });
      call.on(Call.Event.Disconnected, () => {
        const start = connectedAtRef.current;
        const dur =
          typeof start === 'number' ? Math.max(0, Math.round((Date.now() - start) / 1000)) : undefined;
        let dir: CallLogDirection;
        if (meta.direction === 'out') {
          dir = 'outgoing';
        } else {
          dir = dur !== undefined && dur > 0 ? 'incoming' : 'missed';
        }
        appendCallLog(dir, meta.remoteName, meta.remoteNumber, dur ?? 0);
        activeCallRef.current = null;
        setActive(null);
        setMuted(false);
        setCallUiPhase('idle');
        connectedAtRef.current = null;
        setStatusLine('Listo');
      });
      call.on(Call.Event.ConnectFailure, (err) => {
        setStatusLine(`Fallo de conexión: ${String(err)}`);
      });
    },
    [appendCallLog]
  );

  useEffect(() => {
    if (!active || callUiPhase !== 'connected') {
      return;
    }
    const t = setInterval(() => {
      const start = connectedAtRef.current;
      if (typeof start === 'number') {
        setCallElapsedSec(Math.max(0, Math.round((Date.now() - start) / 1000)));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active, callUiPhase]);

  useEffect(() => {
    if (!isNextApiBaseConfigured()) {
      setRegistering(false);
      setStatusLine(
        'EXPO_PUBLIC_NEXT_API_BASE no está configurado en el build. Reconstruye la APK con la URL de tu Next en .env.'
      );
      return;
    }

    const voice = new Voice();
    voiceRef.current = voice;
    let disposed = false;

    const onInvite = (invite: CallInvite) => {
      const from = invite.getFrom() ?? '—';
      setIncoming(invite);
      setActiveCallLabel(contactNameForPhone(from, from));
      setActiveCallNumber(from);
      setStatusLine('Llamada entrante');
    };

    const onError = (err: unknown) => {
      setStatusLine(`Error Twilio: ${err instanceof Error ? err.message : String(err)}`);
    };

    const onRegistered = () => {
      if (disposed) return;
      setRegistered(true);
      setRegistering(false);
      setStatusLine('Listo');
    };

    const onUnregistered = () => {
      setRegistered(false);
    };

    voice.on(Voice.Event.CallInvite, onInvite);
    voice.on(Voice.Event.Error, onError);
    voice.on(Voice.Event.Registered, onRegistered);
    voice.on(Voice.Event.Unregistered, onUnregistered);

    (async () => {
      try {
        const jwt = await fetchTwilioAccessToken(session.access_token);
        if (disposed) return;
        twilioJwtRef.current = jwt;
        await voice.register(jwt);
      } catch (e) {
        if (!disposed) {
          setRegistering(false);
          setStatusLine(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    const interval = setInterval(async () => {
      const v = voiceRef.current;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!v || !token || disposed) return;
      try {
        const jwt = await fetchTwilioAccessToken(token);
        twilioJwtRef.current = jwt;
        await v.register(jwt);
      } catch {
        /* siguiente intervalo */
      }
    }, 45 * 60 * 1000);

    return () => {
      disposed = true;
      clearInterval(interval);
      voice.off(Voice.Event.CallInvite, onInvite);
      voice.off(Voice.Event.Error, onError);
      voice.off(Voice.Event.Registered, onRegistered);
      voice.off(Voice.Event.Unregistered, onUnregistered);
      const jwt = twilioJwtRef.current;
      const v = voiceRef.current;
      activeCallRef.current?.disconnect();
      activeCallRef.current = null;
      if (v && jwt) {
        v.unregister(jwt).catch(() => undefined);
      }
      voiceRef.current = null;
      twilioJwtRef.current = null;
    };
  }, [session.access_token]);

  const hangup = useCallback(() => {
    incoming?.reject();
    setIncoming(null);
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setActive(null);
    setMuted(false);
    setCallUiPhase('idle');
  }, [incoming]);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) return;
    const next = !call.isMuted();
    call.mute(next);
    setMuted(next);
  }, []);

  const answer = useCallback(async () => {
    if (!incoming) return;
    try {
      const from = incoming.getFrom() ?? '—';
      const call = await incoming.accept();
      setIncoming(null);
      attachCall(call, {
        direction: 'in',
        remoteNumber: from,
        remoteName: contactNameForPhone(from, from),
      });
      setStatusLine('En llamada');
    } catch (e) {
      Alert.alert('No se pudo contestar', e instanceof Error ? e.message : String(e));
    }
  }, [incoming, attachCall]);

  const decline = useCallback(() => {
    if (!incoming) return;
    const from = incoming.getFrom() ?? '—';
    incoming.reject();
    setIncoming(null);
    appendCallLog('missed', contactNameForPhone(from, from), from);
    setStatusLine('Listo');
  }, [incoming, appendCallLog]);

  const placeCall = useCallback(async () => {
    const v = voiceRef.current;
    const to = digits.trim();
    if (!v || !to || !registered) {
      Alert.alert('Destino', 'Introduce un número para marcar.');
      return;
    }
    setOutgoingBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const supaToken = data.session?.access_token;
      if (!supaToken) {
        Alert.alert('Sesión', 'Vuelve a iniciar sesión.');
        return;
      }
      const jwt = await fetchTwilioAccessToken(supaToken);
      twilioJwtRef.current = jwt;
      lastOutgoingMetaRef.current = { to };
      const label = contactNameForPhone(to, to);
      setActiveCallLabel(label);
      setActiveCallNumber(to);
      const call = await v.connect(jwt, {
        params: { To: to },
        ...(Platform.OS === 'ios' ? { contactHandle: to } : {}),
      });
      attachCall(call, { direction: 'out', remoteNumber: to, remoteName: label });
      setStatusLine('Marcando…');
    } catch (e) {
      Alert.alert('Llamada', e instanceof Error ? e.message : String(e));
    } finally {
      setOutgoingBusy(false);
    }
  }, [digits, registered, attachCall]);

  const callContact = useCallback(
    async (phone: string, name: string) => {
      setDigits(phone.replace(/\s/g, ''));
      const v = voiceRef.current;
      if (!v || !registered) {
        Alert.alert('Softphone', 'Aún no está registrado en Twilio.');
        return;
      }
      setOutgoingBusy(true);
      try {
        const { data } = await supabase.auth.getSession();
        const supaToken = data.session?.access_token;
        if (!supaToken) {
          Alert.alert('Sesión', 'Vuelve a iniciar sesión.');
          return;
        }
        const jwt = await fetchTwilioAccessToken(supaToken);
        twilioJwtRef.current = jwt;
        setActiveCallLabel(name);
        setActiveCallNumber(phone);
        const call = await v.connect(jwt, {
          params: { To: phone.replace(/\s/g, '') },
          ...(Platform.OS === 'ios' ? { contactHandle: phone } : {}),
        });
        attachCall(call, { direction: 'out', remoteNumber: phone, remoteName: name });
        setStatusLine('Marcando…');
      } catch (e) {
        Alert.alert('Llamada', e instanceof Error ? e.message : String(e));
      } finally {
        setOutgoingBusy(false);
      }
    },
    [registered, attachCall]
  );

  const signOut = useCallback(async () => {
    hangup();
    await supabase.auth.signOut();
  }, [hangup]);

  const dialKey = useCallback((k: string) => {
    setDigits((d) => d + k);
  }, []);

  const backspace = useCallback(() => {
    setDigits((d) => d.slice(0, -1));
  }, []);

  /** Sin registro Twilio listo: aviso en cabecera (o error de configuración). */
  const hasTwilioError = !registering && !registered;

  const value = useMemo<TwilioVoiceContextValue>(
    () => ({
      session,
      registering,
      registered,
      statusLine,
      hasTwilioError,
      digits,
      setDigits,
      incoming,
      active,
      muted,
      outgoingBusy,
      activeCallLabel,
      activeCallNumber,
      activeCallCompany: COMPANY_LABEL,
      callElapsedSec,
      callUiPhase,
      callLog,
      callsFilter,
      setCallsFilter,
      placeCall,
      hangup,
      toggleMute,
      answer,
      decline,
      signOut,
      dialKey,
      backspace,
      callContact,
    }),
    [
      session,
      registering,
      registered,
      statusLine,
      hasTwilioError,
      digits,
      incoming,
      active,
      muted,
      outgoingBusy,
      activeCallLabel,
      activeCallNumber,
      callElapsedSec,
      callUiPhase,
      callLog,
      callsFilter,
      placeCall,
      hangup,
      toggleMute,
      answer,
      decline,
      signOut,
      dialKey,
      backspace,
      callContact,
    ]
  );

  return <TwilioVoiceContext.Provider value={value}>{children}</TwilioVoiceContext.Provider>;
}

export function useTwilioVoice(): TwilioVoiceContextValue {
  const v = useContext(TwilioVoiceContext);
  if (!v) {
    throw new Error('useTwilioVoice debe usarse dentro de TwilioVoiceProvider');
  }
  return v;
}
