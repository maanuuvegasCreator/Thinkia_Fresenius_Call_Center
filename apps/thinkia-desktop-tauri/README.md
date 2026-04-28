# Thinkia — Escritorio (Tauri) — AICONCTATC-93

Aplicación **Windows (.exe / instalador)** que abre el **mismo portal** que en el navegador (Vite bajo `/portal/` en tu dominio Vercel). Sesión, handoff y Twilio funcionan igual que en Chrome.

## Requisitos (Windows)

- [Rust](https://www.rust-lang.org/tools/install) + [prerrequisitos Tauri v1](https://v1.tauri.app/v1/guides/getting-started/prerequisites/).
- **MSVC:** instala [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con **“Desarrollo de escritorio con C++”** (incluye `link.exe` y Windows SDK). Sin esto, `tauri build` falla con `linker link.exe not found`.

## Desarrollo

1. En la **raíz del monorepo**: `npm install` (si no lo hiciste).
2. En esta carpeta: `npm install`
3. Desde la raíz: `npm run dev:desktop`  
   - Arranca Vite (`localhost:5173/portal/`) y el WebView de Tauri apuntando ahí.

Si Vite ya está en marcha (`npm run dev` en la raíz), puedes usar solo `npm run dev` dentro de `apps/thinkia-desktop-tauri`.

## Generar el .exe / instalador

El build empaqueta una página local que **redirige** al portal en producción (por defecto `https://thinkia-fresenius-call-center2.vercel.app/portal/`).

```bash
cd apps/thinkia-desktop-tauri
npm install
npm run build
```

Salidas típicas (Windows):

- **Ejecutable:** `src-tauri/target/release/thinkia-desktop-tauri.exe`
- **Instalador NSIS:** `src-tauri/target/release/bundle/nsis/`
- **MSI:** `src-tauri/target/release/bundle/msi/`

### Otra URL (staging / otro dominio)

Antes de `npm run build`:

```powershell
$env:THINKIA_WEB_URL="https://tu-dominio.com/portal/"
npm run build
```

Eso regenera `dist-web/index.html` vía `scripts/write-shell.mjs`.

## Notas

- No hace falta ejecutar `vite build` del monorepo para el **instalador** del escritorio: el cliente carga la web remota. Sí necesitas Vite en **dev**.
- Firma de código (SmartScreen): configura certificado en `tauri.conf.json` → `bundle.windows` cuando tu organización lo exija.
