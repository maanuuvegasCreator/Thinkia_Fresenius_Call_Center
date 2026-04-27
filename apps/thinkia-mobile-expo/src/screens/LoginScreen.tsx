import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { isSupabaseConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';
import { getApiBase, isNextApiBaseConfigured } from '../lib/twilioToken';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Configuración',
        'Esta APK no incluye EXPO_PUBLIC_SUPABASE_URL ni EXPO_PUBLIC_SUPABASE_ANON_KEY. Genera de nuevo la APK con un archivo .env en apps/thinkia-mobile-expo antes de gradle.'
      );
      return;
    }
    const e = email.trim();
    if (!e || !password) {
      Alert.alert('Datos incompletos', 'Introduce email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        Alert.alert('No se pudo iniciar sesión', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Thinkia</Text>
        <Text style={styles.sub}>Softphone móvil (C3)</Text>
        {!isSupabaseConfigured ? (
          <Text style={styles.warn}>
            Falta configuración Supabase en el build. Crea `.env` con EXPO_PUBLIC_SUPABASE_URL y
            EXPO_PUBLIC_SUPABASE_ANON_KEY y vuelve a generar la APK.
          </Text>
        ) : null}
        {!isNextApiBaseConfigured() ? (
          <Text style={styles.warn}>
            Revisa EXPO_PUBLIC_NEXT_API_BASE (no puede quedar el placeholder de ejemplo).
          </Text>
        ) : null}
        <Text style={styles.hint}>API Next: {getApiBase()}</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="agente@empresa.com"
          placeholderTextColor="#999"
        />
        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.btn, (!isSupabaseConfigured || loading) && styles.btnDisabled]}
          onPress={signIn}
          disabled={!isSupabaseConfigured || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f4f4f5' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  sub: { fontSize: 14, color: '#52525b', marginBottom: 8 },
  hint: { fontSize: 11, color: '#71717a', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#3f3f46', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#18181b',
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  warn: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#92400e',
    marginBottom: 8,
  },
});
