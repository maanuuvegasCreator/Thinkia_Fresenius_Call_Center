import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';

const API_BASE =
  process.env.EXPO_PUBLIC_NEXT_API_BASE ?? 'https://TU-PROYECTO-NEXT.vercel.app';

export default function App() {
  const [accessToken, setAccessToken] = useState('');
  const [preview, setPreview] = useState('');

  const fetchTwilioJwt = async () => {
    const t = accessToken.trim();
    if (!t) {
      Alert.alert('Falta token', 'Pega el access_token de Supabase (sesión).');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/token/mobile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      });
      const body = await res.text();
      if (!res.ok) {
        Alert.alert(`HTTP ${res.status}`, body.slice(0, 500));
        return;
      }
      setPreview(`${body.slice(0, 48)}…`);
      Alert.alert(
        'JWT recibido',
        'Siguiente: instalar @twilio/voice-react-native-sdk, expo prebuild y registrar Voice según C3-PUSH-CALLKIT-SETUP.md'
      );
    } catch (e) {
      Alert.alert('Error de red', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thinkia — C3 móvil</Text>
      <Text style={styles.p}>
        Base API Next:{'\n'}
        {API_BASE}
      </Text>
      <Text style={styles.label}>Supabase access_token (Bearer)</Text>
      <TextInput
        style={styles.input}
        value={accessToken}
        onChangeText={setAccessToken}
        autoCapitalize="none"
        placeholder="eyJhbGciOi…"
        placeholderTextColor="#999"
      />
      <Button title="POST /api/token/mobile" onPress={fetchTwilioJwt} />
      {preview ? <Text style={styles.preview}>{preview}</Text> : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 56,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700' },
  p: { fontSize: 13, color: '#444' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
  },
  preview: { fontSize: 11, color: '#333', marginTop: 8 },
});
