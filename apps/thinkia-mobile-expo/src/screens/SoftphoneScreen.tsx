import type { Session } from '@supabase/supabase-js';
import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchTwilioAccessToken, getApiBase, isNextApiBaseConfigured } from '../lib/twilioToken';

type Props = { session: Session };

export function SoftphoneScreen({ session }: Props) {
  const voiceRef = useRef<Voice | null>(null);
  const twilioJwtRef = useRef<string | null>(null);
  const activeCallRef = useRef<Call | null>(null);

  const [registering, setRegistering] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [statusLine, setStatusLine] = useState('Inicializando…');
  const [digits, setDigits] = useState('');
  const [incoming, setIncoming] = useState<CallInvite | null>(null);
  const [active, setActive] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);
  const [outgoingBusy, setOutgoingBusy] = useState(false);

  const attachCall = useCallback((call: Call) => {
    activeCallRef.current = call;
    setActive(call);
    setMuted(Boolean(call.isMuted()));
    call.on(Call.Event.Connected, () => {
      setStatusLine('En llamada');
    });
    call.on(Call.Event.Ringing, () => {
      setStatusLine('Sonando…');
    });
    call.on(Call.Event.Disconnected, () => {
      activeCallRef.current = null;
      setActive(null);
      setMuted(false);
      setStatusLine('Registrado para llamadas entrantes.');
    });
    call.on(Call.Event.ConnectFailure, (err) => {
      setStatusLine(`Fallo de conexión: ${String(err)}`);
    });
  }, []);

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
      setIncoming(invite);
      setStatusLine('Llamada entrante');
    };

    const onError = (err: unknown) => {
      setStatusLine(`Error Twilio: ${err instanceof Error ? err.message : String(err)}`);
    };

    const onRegistered = () => {
      if (disposed) return;
      setRegistered(true);
      setRegistering(false);
      setStatusLine('Registrado para llamadas entrantes.');
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
        /* ignorar refrescos fallidos; el siguiente intervalo reintenta */
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
      const call = await incoming.accept();
      setIncoming(null);
      attachCall(call);
      setStatusLine('En llamada');
    } catch (e) {
      Alert.alert('No se pudo contestar', e instanceof Error ? e.message : String(e));
    }
  }, [incoming, attachCall]);

  const decline = useCallback(() => {
    if (!incoming) return;
    incoming.reject();
    setIncoming(null);
    setStatusLine('Registrado para llamadas entrantes.');
  }, [incoming]);

  const placeCall = useCallback(async () => {
    const v = voiceRef.current;
    const to = digits.trim();
    if (!v || !to || !registered) {
      Alert.alert('Destino', 'Indica un número (To) para marcar.');
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
      const call = await v.connect(jwt, {
        params: { To: to },
        ...(Platform.OS === 'ios' ? { contactHandle: to } : {}),
      });
      attachCall(call);
      setStatusLine('Marcando…');
    } catch (e) {
      Alert.alert('Llamada', e instanceof Error ? e.message : String(e));
    } finally {
      setOutgoingBusy(false);
    }
  }, [digits, registered, attachCall]);

  const signOut = useCallback(async () => {
    hangup();
    await supabase.auth.signOut();
  }, [hangup]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Softphone</Text>
      <Text style={styles.meta}>Sesión: {session.user.email ?? session.user.id}</Text>
      <Text style={styles.meta}>API: {getApiBase()}</Text>
      <Text style={styles.status}>{statusLine}</Text>
      {registering ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.hint}>Registrando en Twilio…</Text>
        </View>
      ) : null}

      {incoming ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Entrante</Text>
          <Text style={styles.bannerSub}>Desde: {incoming.getFrom() ?? '—'}</Text>
          <View style={styles.rowGap}>
            <TouchableOpacity style={styles.btnOk} onPress={answer}>
              <Text style={styles.btnText}>Contestar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={decline}>
              <Text style={styles.btnText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Número destino (saliente)</Text>
      <TextInput
        style={styles.input}
        value={digits}
        onChangeText={setDigits}
        keyboardType="phone-pad"
        placeholder="+34…"
        placeholderTextColor="#999"
        editable={!outgoingBusy}
      />
      <TouchableOpacity
        style={[styles.btnPrimary, (!registered || outgoingBusy) && styles.btnDisabled]}
        onPress={placeCall}
        disabled={!registered || outgoingBusy}
      >
        {outgoingBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Llamar</Text>
        )}
      </TouchableOpacity>

      {active ? (
        <View style={styles.callBar}>
          <Text style={styles.callTitle}>Llamada activa</Text>
          <View style={styles.rowGap}>
            <TouchableOpacity style={styles.btnGhost} onPress={toggleMute}>
              <Text style={styles.btnGhostText}>{muted ? 'Quitar silencio' : 'Silenciar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={hangup}>
              <Text style={styles.btnText}>Colgar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.flexSpacer} />

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 56, gap: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { fontSize: 12, color: '#52525b' },
  status: { fontSize: 13, color: '#18181b', marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { fontSize: 13, color: '#71717a' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  banner: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 8,
  },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#1e3a8a' },
  bannerSub: { fontSize: 14, color: '#1e40af' },
  rowGap: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnOk: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDanger: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callBar: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 8,
  },
  callTitle: { fontSize: 15, fontWeight: '600' },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: '#18181b' },
  flexSpacer: { flex: 1, minHeight: 16 },
  signOut: { paddingVertical: 12, alignItems: 'center' },
  signOutText: { color: '#64748b', fontSize: 14 },
});
