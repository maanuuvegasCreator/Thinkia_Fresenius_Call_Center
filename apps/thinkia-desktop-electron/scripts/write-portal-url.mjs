/**
 * Genera `portal-url.json` leído en runtime por `main.cjs`.
 * Prioridad: env THINKIA_WEB_URL → default producción.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'portal-url.json');

let base =
  process.env.THINKIA_WEB_URL?.trim() || 'https://thinkia-fresenius-call-center2.vercel.app/portal/';
if (!base.endsWith('/')) base += '/';

fs.writeFileSync(out, JSON.stringify({ base }, null, 0), 'utf8');
console.log('write-portal-url:', out, '→', base);
