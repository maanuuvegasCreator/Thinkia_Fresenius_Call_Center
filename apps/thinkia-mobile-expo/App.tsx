import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import React, { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { isSupabaseConfigured } from './src/lib/env';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';

const SoftphoneLazy = lazy(() =>
  import('./src/screens/SoftphoneScreen').then((m) => ({ default: m.SoftphoneScreen }))
);

class RootErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>La app se ha cerrado por un error</Text>
          <Text style={styles.errorHint} selectable>
            {this.state.err.message}
          </Text>
          <Text style={styles.errorMeta}>
            Si acabas de instalar la APK, suele deberse a variables EXPO_PUBLIC_* no incluidas en el
            build o al softphone Twilio cargando demasiado pronto. Reconstruye con `.env` o revisa
            logcat (`adb logcat`).
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
      })
      .catch((e: unknown) => {
        setBootError(e instanceof Error ? e.message : String(e));
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (bootError) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Error de sesión</Text>
        <Text style={styles.errorHint} selectable>
          {bootError}
        </Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <RootErrorBoundary>
      {session ? (
        <Suspense
          fallback={
            <View style={styles.suspense}>
              <ActivityIndicator size="large" />
              <Text style={styles.suspenseText}>Cargando softphone…</Text>
            </View>
          }
        >
          <SoftphoneLazy session={session} />
        </Suspense>
      ) : (
        <LoginScreen />
      )}
      <StatusBar style="dark" />
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fafafa',
    gap: 12,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#18181b' },
  errorHint: { fontSize: 14, color: '#52525b' },
  errorMeta: { fontSize: 12, color: '#71717a', marginTop: 8 },
  suspense: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  suspenseText: { fontSize: 14, color: '#52525b' },
});
