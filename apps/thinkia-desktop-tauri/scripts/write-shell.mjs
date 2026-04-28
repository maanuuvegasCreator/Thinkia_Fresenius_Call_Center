/**
 * Genera `dist-web/index.html`: el WebView abre esta página y redirige al portal Thinkia
 * (misma app que en el navegador; cookies y Twilio son del dominio remoto).
 *
 * URL por defecto: producción Vercel. Sobrescribe con env:
 *   THINKIA_WEB_URL=https://tu-dominio.com/portal/ node scripts/write-shell.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'dist-web');

let base =
  process.env.THINKIA_WEB_URL?.trim() || 'https://thinkia-fresenius-call-center2.vercel.app/portal/';
if (!base.endsWith('/')) base += '/';

fs.mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Thinkia</title>
  <meta http-equiv="refresh" content="0;url=${escapeAttr(base)}" />
  <style>
    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #f8fafc; color: #475569; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
    a { color: #0f172a; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <p>Abriendo Thinkia…</p>
    <p><a href="${escapeAttr(base)}">Pulsa aquí si no redirige</a></p>
  </div>
  <script>location.replace(${JSON.stringify(base)});</script>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
console.log('write-shell: wrote', path.join(outDir, 'index.html'), '→', base);

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
