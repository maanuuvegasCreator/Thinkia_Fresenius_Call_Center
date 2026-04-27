#!/usr/bin/env node
/**
 * Comprueba variables mínimas para prueba de voz (entrante + softphone web).
 * Uso: desde apps/web → `node scripts/check-voice-setup.mjs`
 * No imprime valores secretos.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_TWIML_APP_SID',
  'TWILIO_CALLER_ID',
  'AUTH_HANDOFF_ALLOWED_ORIGIN',
];

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) {
    return { error: `No existe ${file}. Copia apps/web/.env.example a apps/web/.env y rellena.` };
  }
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    out[k] = v;
  }
  return { vars: out };
}

const loaded = loadEnv(envPath);
if (loaded.error) {
  console.error(loaded.error);
  process.exit(1);
}
const env = loaded.vars;

let ok = true;
for (const key of REQUIRED) {
  const v = env[key];
  const present = v != null && String(v).trim() !== '' && !String(v).includes('xxxx');
  if (!present) {
    console.error(`✗ Falta o está vacío / plantilla: ${key}`);
    ok = false;
  } else {
    console.log(`✓ ${key}`);
  }
}

if (env.TWILIO_CALLER_ID && !env.TWILIO_CALLER_ID.trim().startsWith('+')) {
  console.warn('⚠ TWILIO_CALLER_ID debería ir en E.164 (p. ej. +34…).');
}

console.log('');
if (ok) {
  console.log('Listo: arranca Next (`npm run dev -w web`), ngrok si pruebas entrante desde fuera, y revisa webhooks Twilio → POST …/api/voice');
  process.exit(0);
}
process.exit(1);
