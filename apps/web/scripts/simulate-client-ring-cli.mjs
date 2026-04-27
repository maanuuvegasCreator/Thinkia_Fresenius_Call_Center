#!/usr/bin/env node
/**
 * Crea una llamada Twilio hacia `client:<identity>` (el softphone debe mostrar incoming).
 * Desde `apps/web`:
 *   node scripts/simulate-client-ring-cli.mjs
 *   node scripts/simulate-client-ring-cli.mjs <uuid-supabase>
 *   node scripts/simulate-client-ring-cli.mjs correo@dominio.com
 *
 * No imprime secretos; solo identity y CallSid.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

function loadEnv(file) {
  const out = {};
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
  return out;
}

function twilioClientIdentityFromUserId(userId) {
  return `u${userId.replace(/-/g, '')}`;
}

const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const accountSid = env.TWILIO_ACCOUNT_SID;
const apiKeySid = env.TWILIO_API_KEY_SID;
const apiKeySecret = env.TWILIO_API_KEY_SECRET;
const from = env.TWILIO_CALLER_ID;

if (!url || !serviceKey || !accountSid || !apiKeySid || !apiKeySecret || !from) {
  console.error('Faltan variables en apps/web/.env (Supabase + Twilio). Ejecuta: node scripts/check-voice-setup.mjs');
  process.exit(1);
}

const arg = process.argv[2]?.trim();
let userId = null;

if (arg) {
  if (arg.includes('@')) {
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let page = 1;
    const perPage = 200;
    while (!userId && page < 20) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('Supabase listUsers:', error.message);
        process.exit(1);
      }
      const u = data.users.find((x) => x.email?.toLowerCase() === arg.toLowerCase());
      if (u) userId = u.id;
      if (!data.users.length || data.users.length < perPage) break;
      page += 1;
    }
    if (!userId) {
      console.error(`No hay usuario con email: ${arg}`);
      process.exit(1);
    }
  } else if (/^[0-9a-f-]{36}$/i.test(arg)) {
    userId = arg;
  } else {
    console.error('Argumento no reconocido (usa UUID o email).');
    process.exit(1);
  }
} else {
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error || !data.users[0]) {
    console.error('No se pudo obtener un usuario (listUsers):', error?.message ?? 'lista vacía');
    process.exit(1);
  }
  userId = data.users[0].id;
}

const identity = twilioClientIdentityFromUserId(userId);
const client = twilio(apiKeySid, apiKeySecret, { accountSid });

try {
  const call = await client.calls.create({
    to: `client:${identity}`,
    from,
    twiml: '<Response><Pause length="45"/></Response>',
  });
  console.log(`OK callSid=${call.sid}`);
  console.log(`Marcado a client:${identity} (debe coincidir con el usuario logueado en el portal / token).`);
} catch (e) {
  console.error('Twilio:', e instanceof Error ? e.message : e);
  process.exit(1);
}
